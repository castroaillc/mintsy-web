import type { BookDoc, EpisodeDoc } from "./catalog.js";

/**
 * Catalog search: a plain scan over the published catalog (it's small). Pure functions, so the
 * resolver passes in the public books and a lock check and this never sees unpublished content.
 *
 * Follow-up once the catalog grows: a MongoDB text index or Atlas Search index on title, author,
 * category and episodes.transcript.text, instead of loading every book per search.
 */

/** Queries shorter than this (after trimming) return no results. */
export const MIN_QUERY_LENGTH = 2;
/** Longer queries are cut to this many characters. */
export const MAX_QUERY_LENGTH = 100;
export const MAX_BOOK_RESULTS = 20;
export const MAX_EPISODE_MATCHES = 30;
export const MAX_MATCHES_PER_EPISODE = 3;
/** Transcript lines up to this long are returned whole; longer ones are cut to about SNIPPET_TARGET. */
const SNIPPET_MAX = 120;
const SNIPPET_TARGET = 100;
const ELLIPSIS = "…";

export interface EpisodeMatch {
  book: BookDoc;
  episode: EpisodeDoc;
  startSec: number;
  snippet: string;
  matchStart: number;
  matchLength: number;
}

export interface SearchResult {
  books: BookDoc[];
  episodes: EpisodeMatch[];
}

export const EMPTY_RESULT: SearchResult = { books: [], episodes: [] };

/** Trimmed, whitespace-collapsed and length-capped query, or null when it's too short to search. */
export function normalizeQuery(raw: string): string | null {
  const q = raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH).trim();
  return q.length >= MIN_QUERY_LENGTH ? q : null;
}

/**
 * Case-insensitive literal matcher for a normalized query. Regex metacharacters are escaped;
 * a space matches any run of whitespace and an apostrophe matches straight or curly ones
 * (the catalog uses ’, keyboards type ').
 */
export function queryPattern(q: string): RegExp {
  const source = [...q]
    .map((ch) => {
      if (ch === " ") return "\\s+";
      if (ch === "'" || ch === "’" || ch === "‘") return "['’‘]";
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(source, "iu");
}

/** A window of `text` around [start, start + length), cut at word boundaries, with ellipses. */
export function makeSnippet(text: string, start: number, length: number) {
  if (text.length <= SNIPPET_MAX) return { snippet: text, matchStart: start, matchLength: length };

  const room = Math.max(0, SNIPPET_TARGET - length);
  let from = Math.max(0, start - Math.floor(room / 2));
  let to = Math.min(text.length, from + length + room);
  from = Math.max(0, to - length - room); // shift left if we hit the end

  // Snap to word boundaries without cutting into the match
  if (from > 0) {
    const space = text.indexOf(" ", from);
    if (space !== -1 && space < start) from = space + 1;
  }
  if (to < text.length) {
    const space = text.lastIndexOf(" ", to);
    if (space >= start + length) to = space;
  }

  const body = text.slice(from, to);
  const lead = body.length - body.trimStart().length;
  const prefix = from > 0 ? ELLIPSIS : "";
  const suffix = to < text.length ? ELLIPSIS : "";
  return {
    snippet: prefix + body.trim() + suffix,
    matchStart: prefix.length + (start - from) - lead,
    matchLength: length,
  };
}

/**
 * Searches published books (already filtered by publicBook) for `rawQuery`.
 * - Books: title, author or category contains the query. Title matches first, then author,
 *   then category; catalog order within each group.
 * - Episodes: transcript lines that contain the query, at most 30. Books from the book results come
 *   first (in that order), then the rest in catalog order; then episode / time order; at most
 *   MAX_MATCHES_PER_EPISODE per episode. Episodes for which `isLocked` is true are skipped: the
 *   API never exposes a locked transcript, so search mustn't either.
 */
export function searchCatalog(
  books: BookDoc[],
  rawQuery: string,
  isLocked: (episode: EpisodeDoc) => boolean,
): SearchResult {
  const q = normalizeQuery(rawQuery);
  if (!q) return EMPTY_RESULT;
  const pattern = queryPattern(q);

  const rank = (book: BookDoc) =>
    pattern.test(book.title) ? 0 : pattern.test(book.author) ? 1 : pattern.test(book.category) ? 2 : -1;
  const bookHits = books
    .map((book, index) => ({ book, index, rank: rank(book) }))
    .filter((h) => h.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, MAX_BOOK_RESULTS)
    .map((h) => h.book);

  // Transcript matches from the books that matched come first, then the rest in catalog order
  const hitIds = new Set(bookHits.map((b) => b._id));
  const scanOrder = [...bookHits, ...books.filter((b) => !hitIds.has(b._id))];

  const episodes: EpisodeMatch[] = [];
  outer: for (const book of scanOrder) {
    for (const episode of book.episodes) {
      if (isLocked(episode)) continue;
      let perEpisode = 0;
      for (const line of episode.transcript ?? []) {
        const m = pattern.exec(line.text);
        if (!m) continue;
        episodes.push({ book, episode, startSec: line.startSec, ...makeSnippet(line.text, m.index, m[0].length) });
        if (episodes.length >= MAX_EPISODE_MATCHES) break outer;
        if (++perEpisode >= MAX_MATCHES_PER_EPISODE) break;
      }
    }
  }

  return { books: bookHits, episodes };
}

/** Max key ideas returned per book. */
export const MAX_KEY_IDEAS = 5;

/**
 * "The book in 5 ideas". Curated `keyIdeas` on the book doc win (they're book-level copy, like the
 * description, so everyone sees them). Otherwise: the first takeaway of each episode the viewer can
 * unlock, in episode order, deduplicated. Free viewers therefore get at most FREE_EPISODES ideas.
 */
export function keyIdeas(book: BookDoc, isLocked: (episode: EpisodeDoc) => boolean): string[] {
  const curated = (book.keyIdeas ?? []).map((s) => s.trim()).filter(Boolean);
  if (curated.length) return dedupe(curated).slice(0, MAX_KEY_IDEAS);

  const derived: string[] = [];
  for (const episode of book.episodes) {
    if (isLocked(episode)) continue;
    const first = episode.takeaways?.map((s) => s.trim()).find(Boolean);
    if (first) derived.push(first);
  }
  return dedupe(derived).slice(0, MAX_KEY_IDEAS);
}

function dedupe(items: string[]) {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = s.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
