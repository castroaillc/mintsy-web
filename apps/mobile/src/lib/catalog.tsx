import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import type { Book } from '@/data/types';
import {
  createCatalogSnapshot,
  parseCatalogSnapshot,
  snapshotBooksFor,
  type CatalogSnapshot,
} from '@/lib/catalog-cache';
import { booksQuery, legacyBooksQuery } from '@/lib/catalog-query';
import { graphql } from '@/lib/graphql';
import type { CatalogStatus } from '@/lib/launch-gate';
import { useLaunchSession } from '@/lib/launch-session';
import { HLS_ENABLED } from '@/lib/stream-source';

const BOOKS_QUERY = booksQuery(HLS_ENABLED);
const BOOKS_QUERY_LEGACY = legacyBooksQuery(BOOKS_QUERY);

async function fetchBooks() {
  try {
    return (await graphql<{ books: Book[] }>(BOOKS_QUERY)).books;
  } catch (err) {
    if (!/locked|coverUrl/.test((err as Error).message)) throw err;
    return (await graphql<{ books: Book[] }>(BOOKS_QUERY_LEGACY)).books;
  }
}

/**
 * Coming back to the foreground after this long refetches the catalog, so newly published books show up
 * and the signed video URLs (valid ~1 hour) don't go stale.
 */
const STALE_AFTER_MS = 5 * 60 * 1000;

// ── The copy on the device ──────────────────────────────────────────
// Caches, not Documents: it can always be fetched again, so iOS may purge it and it's never backed up.
// Built on demand, never at import: expo-file-system objects can't be created on web (static export)
const cacheFile = () => new File(Paths.cache, 'catalog.json');
const CACHE_ENABLED = Platform.OS !== 'web';

async function readCachedCatalog(): Promise<CatalogSnapshot | null> {
  if (!CACHE_ENABLED) return null;
  try {
    const file = cacheFile();
    return file.exists ? parseCatalogSnapshot(await file.text()) : null;
  } catch (err) {
    console.warn('Failed to read the saved catalog', err);
    return null;
  }
}

// Writes run one at a time, so an older catalog can't land after a newer one
let writes: Promise<void> = Promise.resolve();
function saveCatalog(books: Book[], userId: string | null) {
  if (!CACHE_ENABLED) return;
  const text = JSON.stringify(createCatalogSnapshot(books, { query: BOOKS_QUERY, userId, now: Date.now() }));
  writes = writes.then(async () => {
    try {
      const file = cacheFile();
      if (!file.exists) file.create();
      await file.write(text);
    } catch (err) {
      console.warn('Failed to save the catalog', err);
    }
  });
}

/** Deletes the catalog saved on this device (account deletion). */
export function clearCatalogCache() {
  if (!CACHE_ENABLED) return;
  writes = writes.then(() => {
    try {
      const file = cacheFile();
      if (file.exists) file.delete();
    } catch (err) {
      console.warn('Failed to delete the saved catalog', err);
    }
  });
}

type CatalogContextValue = {
  /**
   * 'loading': no books yet (none saved for this viewer, and the API hasn't answered). 'ready': books to show, from the
   * API or saved on the device. 'error': the API couldn't be reached and nothing has come from it this launch; `books`
   * may still hold the saved copy, so show it with an offline notice.
   */
  status: CatalogStatus;
  books: Book[];
  /** True while the books are the saved copy and the API hasn't answered yet (or failed). */
  fromDevice: boolean;
  /** The saved copy has been looked at for the current viewer (used or not). The root layout waits for this. */
  deviceChecked: boolean;
  getBook: (id: string) => Book | undefined;
  findEpisode: (episodeId: string) => ReturnType<typeof findEpisodeIn>;
  /** True while a retry after an error is in flight; status stays 'error' until it succeeds. */
  retrying: boolean;
  retry: () => void;
  /**
   * Refetch in the background (status stays as it is). Call after the viewer's access changes
   * (purchase, restore, sign-in/out) so newly unlocked episodes get their video URLs, and for pull-to-refresh.
   */
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function findEpisodeIn(books: Book[], episodeId: string) {
  for (const book of books) {
    const episode = book.episodes.find((e) => e.id === episodeId);
    if (episode) return { book, episode };
  }
  return undefined;
}

/**
 * The book catalog from the backend. Fetched at launch, again whenever the signed-in user changes (locks and video
 * URLs depend on the viewer), and when the app returns to the foreground with a catalog older than STALE_AFTER_MS.
 *
 * Every catalog the API returns is saved on the device for the viewer it was fetched for (`catalog-cache.ts`). At
 * launch that copy is shown at once, if it's for the same viewer and query, while the fetch runs; the fetch replaces it.
 * Only the newest request's answer is used, so a slow launch fetch can't overwrite a later one.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { session, known: sessionKnown } = useLaunchSession();
  const userId = session?.user.id ?? null;

  /** From the API this launch; null until the first answer. */
  const [fetched, setFetched] = useState<Book[] | null>(null);
  /** The newest request failed (cleared by the next success, or when the viewer changes). */
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  /** The saved copy and when it was read (its age is judged then): undefined while it's being read. */
  const [saved, setSaved] = useState<{ snapshot: CatalogSnapshot | null; readAt: number } | undefined>(undefined);

  /** Bumped by every request; an answer for an older one is dropped. */
  const generation = useRef(0);
  const inFlight = useRef(0);
  /** Time of the last successful fetch (ms epoch); null until the first one lands. */
  const lastFetchedAt = useRef<number | null>(null);
  /** The viewer as of the last commit; `known` is false until the first session answer. */
  const viewer = useRef<{ known: boolean; userId: string | null }>({ known: false, userId: null });
  /** A launch answer that came before the viewer was known: saved once it is. */
  const unsaved = useRef<{ books: Book[]; generation: number } | null>(null);

  const run = useCallback(async () => {
    const gen = ++generation.current;
    inFlight.current++;
    try {
      const books = await fetchBooks();
      if (gen !== generation.current) return;
      lastFetchedAt.current = Date.now();
      setFetched(books);
      setFailed(false);
      if (viewer.current.known) saveCatalog(books, viewer.current.userId);
      else unsaved.current = { books, generation: gen };
    } catch (err) {
      if (gen !== generation.current) return;
      console.warn('Failed to load catalog', err);
      setFailed(true);
    } finally {
      inFlight.current--;
    }
  }, []);

  const refresh = useCallback(() => run(), [run]);

  // Launch: read the saved copy and ask the API at the same time
  useEffect(() => {
    let cancelled = false;
    readCachedCatalog().then((snapshot) => {
      if (!cancelled) setSaved({ snapshot, readAt: Date.now() });
    });
    // run sets state only after the request answers
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run();
    return () => {
      cancelled = true;
    };
  }, [run]);

  // Sign-in, sign-out or switching accounts: refetch for the new viewer (the launch fetch covers the first one)
  const lastUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    viewer.current = { known: sessionKnown, userId };
    if (!sessionKnown) return;
    if (lastUserId.current !== undefined && lastUserId.current !== userId) {
      // An earlier failure was for the previous viewer: show this one's loading state, not an error
      setFailed(false);
      run();
    }
    lastUserId.current = userId;
    // The launch answer, fetched with the cookie of the viewer now known
    if (unsaved.current && unsaved.current.generation === generation.current) saveCatalog(unsaved.current.books, userId);
    unsaved.current = null;
  }, [sessionKnown, userId, run]);

  // Back in the foreground: refetch quietly when the catalog is stale, or never arrived (e.g. launched offline)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || inFlight.current > 0) return;
      const fetchedAt = lastFetchedAt.current;
      if (fetchedAt === null || Date.now() - fetchedAt > STALE_AFTER_MS) run();
    });
    return () => sub.remove();
  }, [run]);

  // The saved copy applies only to the viewer it was fetched for, and only until the API answers
  const deviceChecked = sessionKnown && saved !== undefined;
  const savedBooks = useMemo(
    () =>
      sessionKnown && saved
        ? snapshotBooksFor(saved.snapshot, { query: BOOKS_QUERY, userId, now: saved.readAt })
        : null,
    [sessionKnown, saved, userId],
  );
  const books = fetched ?? savedBooks ?? EMPTY;
  const status: CatalogStatus = fetched ? 'ready' : failed ? 'error' : savedBooks ? 'ready' : 'loading';

  const value = useMemo<CatalogContextValue>(
    () => ({
      status,
      books,
      fromDevice: !fetched && !!savedBooks,
      deviceChecked,
      getBook: (id) => books.find((b) => b.id === id),
      findEpisode: (episodeId) => findEpisodeIn(books, episodeId),
      retrying,
      retry: () => {
        setRetrying(true);
        run().finally(() => setRetrying(false));
      },
      refresh,
    }),
    [status, books, fetched, savedBooks, deviceChecked, retrying, run, refresh],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

const EMPTY: Book[] = [];

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
