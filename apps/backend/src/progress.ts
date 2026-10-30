import { MongoServerError } from "mongodb";
import { books, publicBook, type BookDoc, type EpisodeDoc } from "./catalog.js";
import { db } from "./db.js";

/**
 * Watch progress: one doc per (user, episode). Written by setProgress from the iPhone and web apps,
 * read by continueWatching / progress(bookId) / finishedBookIds.
 */
export interface WatchProgressDoc {
  userId: string;
  /** "<bookId>-<number>", the same ids as Episode.id and saved episode ids. */
  episodeId: string;
  bookId: string;
  episodeNumber: number;
  /** Seconds into the episode, clamped to [0, durationSec]. */
  positionSec: number;
  /** The episode's duration when this was last written (used if the episode is later unpublished). */
  durationSec: number;
  /** Watched to the end (position ≥ 95% of the duration, or the client said so). */
  completed: boolean;
  /** Server time of the last write; last write wins. */
  updatedAt: Date;
}

export const watchProgress = db.collection<WatchProgressDoc>("watch_progress");

export async function ensureProgressIndexes() {
  await watchProgress.createIndex({ userId: 1, episodeId: 1 }, { unique: true });
  // continueWatching: the user's most recent activity first
  await watchProgress.createIndex({ userId: 1, updatedAt: -1 });
  // progress(bookId)
  await watchProgress.createIndex({ userId: 1, bookId: 1, episodeNumber: 1 });
}

/** A position at or past this fraction of the duration marks the episode completed. */
export const COMPLETED_FRACTION = 0.95;
/**
 * A write that moves the position backwards within this long of the previous write is treated as an
 * out-of-order delivery of an older save and ignored (completion changes always apply).
 */
export const OUT_OF_ORDER_WINDOW_MS = 2000;
export const CONTINUE_WATCHING_MAX = 50;
/** Most progress docs read per continueWatching / finishedBookIds call. */
const MAX_SCAN = 5000;

/** What GraphQL resolves from: a progress record and its published book / episode (null when not live). */
export interface ProgressView extends Omit<WatchProgressDoc, "userId"> {
  book: BookDoc | null;
  episode: EpisodeDoc | null;
}

export function parseEpisodeId(id: string): { bookId: string; number: number } | null {
  const match = /^(.+)-(\d{1,6})$/.exec(id);
  if (!match) return null;
  const number = Number(match[2]);
  return number >= 1 ? { bookId: match[1]!, number } : null;
}

/** Published versions of the given books (drafts and books without published episodes are left out). */
async function publishedBooks(ids: string[]): Promise<Map<string, BookDoc>> {
  if (!ids.length) return new Map();
  const docs = await books.find({ _id: { $in: ids }, status: { $ne: "draft" } }).toArray();
  const map = new Map<string, BookDoc>();
  for (const doc of docs) {
    const book = publicBook(doc);
    if (book) map.set(book._id, book);
  }
  return map;
}

function view(doc: Omit<WatchProgressDoc, "userId">, book: BookDoc | null): ProgressView {
  const { episodeId, bookId, episodeNumber, positionSec, durationSec, completed, updatedAt } = doc;
  const episode = book?.episodes.find((e) => e.number === episodeNumber) ?? null;
  return { episodeId, bookId, episodeNumber, positionSec, durationSec, completed, updatedAt, book, episode };
}

export type SetProgressResult = ProgressView | "unknown-episode" | "locked";

/**
 * Stores the viewer's position in a published episode. Idempotent; the server's clock decides the
 * order (last write wins), except that a backwards move arriving within OUT_OF_ORDER_WINDOW_MS of
 * the previous write is ignored. `completed`: true / false set it explicitly (false = mark as not
 * watched); null keeps the stored value, and a position ≥ 95% of the duration sets it.
 */
export async function setProgress(
  userId: string,
  episodeId: string,
  positionSec: number,
  completed: boolean | null | undefined,
  isLocked: (episode: EpisodeDoc) => boolean,
): Promise<SetProgressResult> {
  const parsed = parseEpisodeId(episodeId);
  if (!parsed) return "unknown-episode";
  const book = (await publishedBooks([parsed.bookId])).get(parsed.bookId) ?? null;
  const episode = book?.episodes.find((e) => e.number === parsed.number);
  if (!book || !episode) return "unknown-episode";
  if (isLocked(episode)) return "locked";

  const now = Date.now();
  const durationSec = Math.max(0, Math.round(episode.durationSec || 0));
  const position = Math.min(Math.max(0, Math.round(positionSec)), durationSec);
  const reachedEnd = durationSec > 0 && position >= COMPLETED_FRACTION * durationSec;
  const completedValue =
    typeof completed === "boolean" ? completed : reachedEnd ? true : { $ifNull: ["$completed", false] };
  const guardOutOfOrder = typeof completed !== "boolean" && !reachedEnd;
  const id = `${book._id}-${episode.number}`;

  const filter = {
    userId,
    episodeId: id,
    ...(guardOutOfOrder
      ? { $nor: [{ updatedAt: { $gt: new Date(now - OUT_OF_ORDER_WINDOW_MS) }, positionSec: { $gt: position } }] }
      : {}),
  };
  // Pipeline update so `completed` can depend on the stored value; strings go through $literal
  const update = [
    {
      $set: {
        userId: { $literal: userId },
        episodeId: { $literal: id },
        bookId: { $literal: book._id },
        episodeNumber: episode.number,
        positionSec: position,
        durationSec,
        completed: completedValue,
        updatedAt: new Date(now),
      },
    },
  ];
  let doc: WatchProgressDoc | null;
  try {
    doc = await watchProgress.findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after" });
  } catch (err) {
    // The out-of-order guard missed the existing doc, so the upsert collided on { userId, episodeId }:
    // a newer save is stored, keep it. (Also: two first saves racing.)
    if (!(err instanceof MongoServerError && err.code === 11000)) throw err;
    doc = await watchProgress.findOne({ userId, episodeId: id });
  }
  if (!doc) throw new Error("setProgress: progress doc missing after upsert");
  return view(doc, book);
}

/**
 * One entry per book, the book with the most recent activity first:
 * - the most recently updated episode of the book, if it isn't completed and is still published;
 * - otherwise the next episode after it that isn't completed (then the first unfinished one before it),
 *   with its stored progress or position 0. That episode may be locked for the viewer (the client shows
 *   an upsell; Episode.locked says so);
 * - books where every published episode is completed are skipped, as are unpublished books.
 */
export async function continueWatching(userId: string, limit: number): Promise<ProgressView[]> {
  const max = Math.min(Math.max(0, Math.floor(limit)), CONTINUE_WATCHING_MAX);
  if (max === 0) return [];
  const docs = await watchProgress.find({ userId }).sort({ updatedAt: -1, _id: -1 }).limit(MAX_SCAN).toArray();
  const byBook = new Map<string, WatchProgressDoc[]>();
  for (const doc of docs) {
    const list = byBook.get(doc.bookId);
    if (list) list.push(doc);
    else byBook.set(doc.bookId, [doc]);
  }
  const catalog = await publishedBooks([...byBook.keys()]);
  const result: ProgressView[] = [];
  for (const [bookId, list] of byBook) {
    if (result.length >= max) break;
    const book = catalog.get(bookId);
    if (!book) continue;
    const latest = list[0]!;
    const stillPublished = book.episodes.some((e) => e.number === latest.episodeNumber);
    if (!latest.completed && stillPublished) {
      result.push(view(latest, book));
      continue;
    }
    const byNumber = new Map(list.map((d) => [d.episodeNumber, d]));
    const after = book.episodes.filter((e) => e.number > latest.episodeNumber);
    const before = book.episodes.filter((e) => e.number < latest.episodeNumber);
    const next = [...after, ...before].find((e) => !byNumber.get(e.number)?.completed);
    if (!next) continue; // the whole series is finished
    const stored = byNumber.get(next.number);
    result.push(
      view(
        stored ?? {
          episodeId: `${bookId}-${next.number}`,
          bookId,
          episodeNumber: next.number,
          positionSec: 0,
          durationSec: next.durationSec,
          completed: false,
          // Not watched yet: report when the book was last active
          updatedAt: latest.updatedAt,
        },
        book,
      ),
    );
  }
  return result;
}

/** Every episode of one book with stored progress, by episode number (including unpublished ones). */
export async function progressForBook(userId: string, bookId: string): Promise<ProgressView[]> {
  const docs = await watchProgress.find({ userId, bookId }).sort({ episodeNumber: 1 }).toArray();
  if (!docs.length) return [];
  const book = (await publishedBooks([bookId])).get(bookId) ?? null;
  return docs.map((d) => view(d, book));
}

/** Published books whose every published episode is completed, most recently finished first. */
export async function finishedBookIds(userId: string): Promise<string[]> {
  const docs = await watchProgress
    .find({ userId, completed: true }, { projection: { _id: 0, bookId: 1, episodeNumber: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .limit(MAX_SCAN)
    .toArray();
  const completed = new Map<string, Set<number>>();
  for (const d of docs) {
    const set = completed.get(d.bookId);
    if (set) set.add(d.episodeNumber);
    else completed.set(d.bookId, new Set([d.episodeNumber]));
  }
  const catalog = await publishedBooks([...completed.keys()]);
  return [...completed.keys()].filter((bookId) => {
    const book = catalog.get(bookId);
    return !!book && book.episodes.every((e) => completed.get(bookId)!.has(e.number));
  });
}

export async function deleteProgressForUser(userId: string) {
  return (await watchProgress.deleteMany({ userId })).deletedCount;
}
