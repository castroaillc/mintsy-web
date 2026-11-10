import type { Book } from '../data/types';

/**
 * The last catalog the API returned, kept on the device so a relaunch can show it at once while a fresh copy loads.
 * Pure (type imports only), so scripts/catalog-cache.test.mjs can check it under plain Node. The file itself is read
 * and written by `catalog.tsx`.
 *
 * A snapshot is used only when all of these hold:
 * - `version` is CATALOG_CACHE_VERSION. Bump it when the stored shape or the way it's read changes.
 * - `query` is the exact query text this build sends. A build that asks for different fields (a new field, the HLS
 *   flag) never reads books fetched with another query.
 * - `userId` is the viewer now. Locks and video URLs depend on who asked, so one account's copy never shows for
 *   another, or for a signed-out viewer.
 * - It's younger than CATALOG_CACHE_MAX_AGE_MS and not from the future.
 * - Every book and episode has an id, and the lists are arrays.
 */

export const CATALOG_CACHE_VERSION = 1;

/** Signed thumbnails last 7 days at most (backend `media.ts`), and access may have changed long before then. */
export const CATALOG_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Allowed clock drift when the snapshot looks newer than the device clock. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export type CatalogSnapshot = {
  version: number;
  query: string;
  /** Better Auth user the books were fetched for; null when signed out. */
  userId: string | null;
  /** ms epoch */
  savedAt: number;
  books: Book[];
};

type SnapshotKey = { query: string; userId: string | null; now: number };

export function createCatalogSnapshot(books: Book[], { query, userId, now }: SnapshotKey): CatalogSnapshot {
  return { version: CATALOG_CACHE_VERSION, query, userId, savedAt: now, books };
}

/** The file's text as a snapshot, or null when it's missing, unreadable, from another version or malformed. */
export function parseCatalogSnapshot(text: string | null | undefined): CatalogSnapshot | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<CatalogSnapshot>;
  if (s.version !== CATALOG_CACHE_VERSION) return null;
  if (typeof s.query !== 'string' || typeof s.savedAt !== 'number') return null;
  if (s.userId !== null && typeof s.userId !== 'string') return null;
  if (!Array.isArray(s.books) || !s.books.every(isBookLike)) return null;
  return s as CatalogSnapshot;
}

/** The snapshot's books if they may be shown to this viewer with this query now, else null. */
export function snapshotBooksFor(snapshot: CatalogSnapshot | null, { query, userId, now }: SnapshotKey): Book[] | null {
  if (!snapshot) return null;
  if (snapshot.query !== query || snapshot.userId !== userId) return null;
  const age = now - snapshot.savedAt;
  if (age > CATALOG_CACHE_MAX_AGE_MS || age < -FUTURE_SKEW_MS) return null;
  return snapshot.books;
}

function isBookLike(book: unknown): boolean {
  if (!book || typeof book !== 'object') return false;
  const b = book as { id?: unknown; title?: unknown; episodes?: unknown };
  if (typeof b.id !== 'string' || typeof b.title !== 'string' || !Array.isArray(b.episodes)) return false;
  return b.episodes.every((e: unknown) => {
    if (!e || typeof e !== 'object') return false;
    const ep = e as { id?: unknown; number?: unknown; transcript?: unknown };
    return typeof ep.id === 'string' && typeof ep.number === 'number' && Array.isArray(ep.transcript);
  });
}
