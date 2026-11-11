import "server-only";
import { booksCol, jobsCol } from "./mongo";
import { effectiveStatus, liveRunLength } from "./status";
import type { BookDoc, ContentStatus, EpisodeDoc, IngestResult, ScriptResult, StudioJob, TranscriptLine } from "./types";
import { describeChapterFailure } from "./generate-all";
import { listJobs } from "./jobs";

export type BookRow = {
  id: string;
  order: number | null;
  title: string;
  author: string;
  /** Catalog status, or the ingest state when the book isn't in `books` yet. */
  status: ContentStatus | "ingesting" | "ingest failed";
  published: number;
  live: number;
  total: number;
  updatedAt: string | null;
};

function lastUpdated(b: BookDoc): Date | null {
  const dates = [b.updatedAt, ...b.episodes.map((e) => e.updatedAt)].filter((d): d is Date => d instanceof Date);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/** Only what the list shows: MongoDB is remote, and a voiced book's transcripts and captions run to about 1 MB. */
const BOOK_ROW_PROJECTION = { title: 1, author: 1, order: 1, status: 1, updatedAt: 1, "episodes.number": 1, "episodes.status": 1, "episodes.updatedAt": 1 };

/** `startSec` values only, as a plain number array, for a transcript that may be missing. */
const startSecs = (path: string) => ({
  $cond: [{ $isArray: path }, { $map: { input: path, as: "line", in: "$$line.startSec" } }, "$$REMOVE"],
});

/**
 * The book for a page, without transcript text and captions, which the pages never show: a voiced book's
 * run to about 1 MB, and MongoDB is remote. The publish checks still need every `startSec`, so transcripts
 * come back as number arrays, a third of the bytes of `{ startSec }` objects, and `toPageBook` rebuilds
 * the lines. `fullTranscriptOf` keeps one episode's top-level transcript whole, for the episode editor.
 */
export async function findPageBook(id: string, fullTranscriptOf?: number): Promise<BookDoc | null> {
  const [doc] = await (await booksCol())
    .aggregate<BookDoc>([
      { $match: { _id: id } },
      { $unset: ["episodes.voices.captions"] },
      {
        $set: {
          episodes: {
            $map: {
              input: "$episodes",
              as: "e",
              in: {
                $mergeObjects: [
                  "$$e",
                  {
                    transcript: { $cond: [{ $eq: ["$$e.number", fullTranscriptOf ?? null] }, "$$e.transcript", startSecs("$$e.transcript")] },
                    voices: {
                      $cond: [
                        { $isArray: "$$e.voices" },
                        { $map: { input: "$$e.voices", as: "v", in: { $mergeObjects: ["$$v", { transcript: startSecs("$$v.transcript") }] } } },
                        "$$REMOVE",
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ])
    .toArray();
  return doc ? toPageBook(doc) : null;
}

/** Turns findPageBook's number arrays back into transcript lines, without their `text`. A whole transcript stays as it is. */
function toPageBook(doc: BookDoc): BookDoc {
  const lines = (t: unknown) =>
    (Array.isArray(t) ? t.map((l: unknown) => (typeof l === "number" ? ({ startSec: l } as TranscriptLine) : l)) : t) as TranscriptLine[];
  return {
    ...doc,
    episodes: (doc.episodes ?? []).map((e) => ({
      ...e,
      transcript: lines(e.transcript),
      ...(e.voices ? { voices: e.voices.map((v) => ({ ...v, transcript: lines(v.transcript) })) } : {}),
    })),
  };
}

export async function listBookRows(): Promise<BookRow[]> {
  const [books, ingests] = await Promise.all([
    (await booksCol()).find({}, { projection: BOOK_ROW_PROJECTION }).sort({ order: 1, _id: 1 }).toArray(),
    listJobs({ kind: "ingest" }, 500),
  ]);
  console.log(`listBookRows: found ${books.length} books in catalog`);
  const rows: BookRow[] = books.map((b) => {
    const eps = b.episodes ?? [];
    const u = lastUpdated(b);
    return {
      id: b._id,
      order: b.order ?? null,
      title: b.title,
      author: b.author,
      status: effectiveStatus(b.status),
      published: eps.filter((e) => effectiveStatus(e.status) === "published").length,
      live: liveRunLength(eps),
      total: eps.length,
      updatedAt: u?.toISOString() ?? null,
    };
  });

  // Books whose ingest hasn't created the catalog doc yet.
  const known = new Set(books.map((b) => b._id));
  const seen = new Set<string>();
  for (const j of ingests) {
    if (known.has(j.bookId) || seen.has(j.bookId)) continue;
    seen.add(j.bookId); // newest first, so this is the latest ingest for the id
    if (j.status === "succeeded") continue; // worker should have inserted the book; nothing to show
    rows.push({
      id: j.bookId,
      order: null,
      title: j.bookId,
      author: "",
      status: j.status === "failed" ? "ingest failed" : "ingesting",
      published: 0,
      live: 0,
      total: 0,
      updatedAt: (j.finishedAt ?? j.startedAt ?? j.createdAt).toISOString(),
    });
  }
  return rows;
}

/** A book id is taken if it's in `books` or has an ingest job that hasn't failed. */
export async function bookIdTaken(id: string) {
  if (await (await booksCol()).findOne({ _id: id }, { projection: { _id: 1 } })) return "A book with this id already exists.";
  const pending = await (await jobsCol()).findOne(
    { kind: "ingest", bookId: id, status: { $in: ["queued", "running", "succeeded"] } },
    { projection: { _id: 1 } },
  );
  if (pending) return "An ingest job for this id already exists.";
  return null;
}

export type ChapterState =
  | "not started"
  | "generating script"
  | "script ready"
  | "rendering"
  | "preview ready"
  | "uploading"
  | "draft"
  | "published"
  | "failed";

export type ChapterRow = {
  number: number;
  title: string;
  state: ChapterState;
  episodeStatus: ContentStatus | null;
  /** A script job succeeded at some point, so there is a script to review. */
  hasScript: boolean;
  active: boolean;
  error: string | null;
  latestJobKind: StudioJob["kind"] | null;
};

export async function getBookPageData(id: string) {
  const [book, jobs] = await Promise.all([
    findPageBook(id),
    listJobs({ bookId: id }, 1000),
  ]);
  const ingests = jobs.filter((j) => j.kind === "ingest");
  const latestIngest = ingests[0] ?? null;
  const succeededIngest = ingests.find((j) => j.status === "succeeded") ?? null;
  const ingestResult = (succeededIngest?.result as IngestResult | undefined) ?? null;

  const episodes: EpisodeDoc[] = book?.episodes ?? [];
  const titles = new Map<number, string>();
  for (const c of ingestResult?.chapters ?? []) titles.set(c.number, c.title);
  for (const e of episodes) if (!titles.has(e.number)) titles.set(e.number, e.title);

  const chapters: ChapterRow[] = [...titles.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, title]) => {
      const chapterJobs = jobs.filter((j) => j.chapter === number && j.kind !== "ingest");
      // A clip is local and leaves the episode alone, so it says nothing about the chapter's state.
      const pipelineJobs = chapterJobs.filter((j) => j.kind !== "clip");
      const latest = pipelineJobs[0];
      const ep = episodes.find((e) => e.number === number);
      const episodeStatus = ep ? effectiveStatus(ep.status) : null;
      // A whole-book run queues a script and then a render, so the job at work is the oldest active one.
      const current = chapterJobs.findLast((j) => j.status === "queued" || j.status === "running");
      const active = !!current;
      let state: ChapterState = "not started";
      if (current) state = current.kind === "script" ? "generating script" : current.kind === "upload" ? "uploading" : "rendering";
      else if (latest?.status === "failed") state = "failed";
      else if (latest?.kind === "script" && latest.status === "succeeded") state = "script ready";
      else if (latest?.kind === "render" && latest.preview && latest.status === "succeeded") state = "preview ready";
      else if (episodeStatus) state = episodeStatus;
      return {
        number,
        title: ep?.title ?? title,
        state,
        episodeStatus,
        hasScript: chapterJobs.some((j) => j.kind === "script" && j.status === "succeeded"),
        active,
        error: describeChapterFailure(pipelineJobs),
        latestJobKind: latest?.kind ?? null,
      };
    });

  return { book, latestIngest, ingestResult, chapters, jobs };
}

/** The latest succeeded script job for a chapter (its result holds script.json + scenes.json). */
export async function latestScript(bookId: string, chapter: number) {
  const job = await (await jobsCol()).findOne(
    { bookId, chapter, kind: "script", status: "succeeded" },
    { sort: { createdAt: -1, _id: -1 } },
  );
  if (!job) return null;
  return { jobId: job._id.toHexString(), finishedAt: job.finishedAt ?? job.createdAt, result: job.result as ScriptResult };
}
