import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { Book } from '@/data/types';
import { authClient } from '@/lib/auth-client';
import { graphql } from '@/lib/graphql';

const BOOKS_QUERY = `#graphql
  query Books {
    books {
      id
      title
      author
      category
      coverTone
      coverUrl
      tint
      description
      episodes {
        id
        number
        title
        summary
        durationSec
        transcript { startSec text }
        takeaways
        videoUrl
        thumbnailUrl
        locked
      }
    }
  }
`;

/**
 * Older backends lack newer fields: `Episode.locked` (pre-Premium; the app then decides locks itself)
 * and `Book.coverUrl` (pre-covers; tiles are drawn instead).
 */
const BOOKS_QUERY_LEGACY = BOOKS_QUERY.replace(/^\s*locked\n/m, '').replace(/^\s*coverUrl\n/m, '');

async function fetchBooks() {
  try {
    return (await graphql<{ books: Book[] }>(BOOKS_QUERY)).books;
  } catch (err) {
    if (!/locked|coverUrl/.test((err as Error).message)) throw err;
    return (await graphql<{ books: Book[] }>(BOOKS_QUERY_LEGACY)).books;
  }
}

type CatalogStatus = 'loading' | 'ready' | 'error';

/**
 * Coming back to the foreground after this long refetches the catalog, so newly published books show up
 * and the signed video URLs (valid ~1 hour) don't go stale.
 */
const STALE_AFTER_MS = 5 * 60 * 1000;

type CatalogContextValue = {
  status: CatalogStatus;
  books: Book[];
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
 * The book catalog from the backend, fetched at launch (the root layout waits for it) and again whenever
 * the signed-in user changes, since locks and video URLs depend on the viewer. Also refetched when the app
 * returns to the foreground with a catalog older than STALE_AFTER_MS.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const [retrying, setRetrying] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  /** Time of the last successful fetch (ms epoch); null until the first one lands. */
  const lastFetchedAt = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchBooks();
      lastFetchedAt.current = Date.now();
      setBooks(fresh);
      setStatus('ready');
    } catch (err) {
      console.warn('Failed to refresh catalog', err);
    }
  }, []);

  // Sign-in, sign-out or switching accounts: refetch for the new viewer (the launch fetch covers the first session)
  const lastUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isPending) return;
    if (lastUserId.current !== undefined && lastUserId.current !== userId) refresh();
    lastUserId.current = userId;
  }, [isPending, userId, refresh]);

  const load = useCallback(() => {
    fetchBooks()
      .then((fresh) => {
        lastFetchedAt.current = Date.now();
        setBooks(fresh);
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('Failed to load catalog', err);
        setStatus('error');
      })
      .finally(() => setRetrying(false));
  }, []);

  useEffect(load, [load]);

  // Back in the foreground with a stale catalog: refetch quietly (an error at launch is handled by retry instead)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const fetchedAt = lastFetchedAt.current;
      if (state === 'active' && fetchedAt !== null && Date.now() - fetchedAt > STALE_AFTER_MS) refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo<CatalogContextValue>(
    () => ({
      status,
      books,
      getBook: (id) => books.find((b) => b.id === id),
      findEpisode: (episodeId) => findEpisodeIn(books, episodeId),
      retrying,
      retry: () => {
        setRetrying(true);
        load();
      },
      refresh,
    }),
    [status, books, retrying, load, refresh],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
