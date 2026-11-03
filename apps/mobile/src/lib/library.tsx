import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { authClient } from '@/lib/auth-client';
import { readUserJson, writeUserJson } from '@/lib/user-files';

/**
 * The signed-in user's local library data: when each series was finished, their 1–5 rating of it, and recent
 * searches. There's no API for any of it yet, so it lives on this device (`users/<id>/library.json`).
 */
export type LibraryData = {
  /** bookId → ISO 8601 date the series was finished (Series complete). */
  finished: Record<string, string>;
  /** bookId → 1–5 */
  ratings: Record<string, number>;
  /** Most recent first. */
  recentSearches: string[];
};

const EMPTY: LibraryData = { finished: {}, ratings: {}, recentSearches: [] };
const FILE = 'library';
const MAX_RECENT = 8;

type LibraryContextValue = LibraryData & {
  markFinished: (bookId: string) => void;
  rate: (bookId: string, stars: number) => void;
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState(() => ({ userId, data: userId ? readUserJson(userId, FILE, EMPTY) : EMPTY }));
  if (state.userId !== userId) setState({ userId, data: userId ? readUserJson(userId, FILE, EMPTY) : EMPTY });

  const update = useCallback((change: (prev: LibraryData) => LibraryData) => {
    setState((prev) => {
      if (!prev.userId) return prev;
      const data = change(prev.data);
      if (data === prev.data) return prev;
      writeUserJson(prev.userId, FILE, data);
      return { ...prev, data };
    });
  }, []);

  const value = useMemo<LibraryContextValue>(() => {
    const data = state.userId === userId ? state.data : EMPTY;
    return {
      ...data,
      markFinished: (bookId) =>
        update((prev) => (prev.finished[bookId] ? prev : { ...prev, finished: { ...prev.finished, [bookId]: new Date().toISOString() } })),
      rate: (bookId, stars) => update((prev) => ({ ...prev, ratings: { ...prev.ratings, [bookId]: stars } })),
      addRecentSearch: (query) => {
        const q = query.trim();
        if (q.length < 2) return;
        update((prev) => ({
          ...prev,
          recentSearches: [q, ...prev.recentSearches.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT),
        }));
      },
      removeRecentSearch: (query) =>
        update((prev) => ({ ...prev, recentSearches: prev.recentSearches.filter((r) => r !== query) })),
      clearRecentSearches: () => update((prev) => ({ ...prev, recentSearches: [] })),
    };
  }, [state, userId, update]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
