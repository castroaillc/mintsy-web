"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useToast } from "@/components/toast";
import { useSession } from "./auth-client";
import { gql } from "./graphql";
import {
  BOOK_PROGRESS_QUERY,
  BOOK_QUERY,
  CATALOG_QUERY,
  CONTINUE_QUERY,
  ME_QUERY,
  SEARCH_QUERY,
  SET_SAVED_MUTATION,
} from "./queries";
import type { Book, EpisodeProgress, Me, SavedKind, SearchResult } from "./types";

/** SWR keys: [document, variables]. Kept here so mutations can revalidate the right entries. */
export const keys = {
  catalog: [CATALOG_QUERY] as const,
  me: [ME_QUERY] as const,
  continue: [CONTINUE_QUERY, { limit: 20 }] as const,
  book: (id: string) => [BOOK_QUERY, { id }] as const,
  progress: (bookId: string) => [BOOK_PROGRESS_QUERY, { bookId }] as const,
  search: (query: string) => [SEARCH_QUERY, { query }] as const,
};

/** Session (Better Auth) + `me` (Premium, My List) for the signed-in viewer. */
export function useViewer() {
  const { data: session, isPending } = useSession();
  const userId = session?.user.id ?? null;
  const me = useSWR<{ me: Me | null }>(userId ? keys.me : null);
  const premium = me.data?.me?.premium ?? null;
  return {
    session,
    user: session?.user ?? null,
    userId,
    /** Session check still in flight. */
    pending: isPending,
    me: me.data?.me ?? null,
    meLoading: !!userId && me.isLoading,
    premium,
    isPremium: !!premium?.active,
    reloadMe: me.mutate,
  };
}

export function useCatalog() {
  const res = useSWR<{ books: Book[] }>(keys.catalog, { keepPreviousData: true });
  return { ...res, books: res.data?.books ?? [] };
}

/** One book with transcripts and (signed, expiring) video URLs. SWR refetches it on focus. */
export function useBook(id: string, fallback?: Book | null) {
  const res = useSWR<{ book: Book | null }>(keys.book(id), {
    fallbackData: fallback !== undefined ? { book: fallback } : undefined,
    revalidateOnMount: true,
  });
  return { ...res, book: res.data?.book ?? null };
}

export function useContinue(enabled: boolean) {
  const res = useSWR<{ me: { continueWatching: EpisodeProgress[]; finishedBookIds: string[] } | null }>(
    enabled ? keys.continue : null,
  );
  return {
    ...res,
    entries: res.data?.me?.continueWatching ?? [],
    finishedBookIds: res.data?.me?.finishedBookIds ?? [],
  };
}

export function useBookProgress(bookId: string, enabled: boolean) {
  const res = useSWR<{ me: { progress: EpisodeProgress[] } | null }>(enabled ? keys.progress(bookId) : null);
  return { ...res, progress: res.data?.me?.progress ?? [] };
}

export function useSearch(query: string) {
  const q = query.trim();
  return useSWR<{ search: SearchResult }>(q.length >= 2 ? keys.search(q) : null, { keepPreviousData: true });
}

/** Revalidate everything that depends on the viewer's watch progress. */
export function useRefreshProgress() {
  const { mutate } = useSWRConfig();
  return useCallback(
    (bookId?: string) => {
      mutate(keys.continue);
      if (bookId) mutate(keys.progress(bookId));
    },
    [mutate],
  );
}

/**
 * My List (`me.savedBookIds` / `savedEpisodeIds`, `setSaved`). Optimistic, with the DeskStates toasts:
 * "Saved to My List · Undo", and "Couldn’t save. Check your connection. · Retry" on failure.
 */
export function useSaved() {
  const { userId, me } = useViewer();
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const isSaved = useCallback(
    (kind: SavedKind, id: string) => {
      const list = kind === "BOOK" ? me?.savedBookIds : me?.savedEpisodeIds;
      return !!list?.includes(id);
    },
    [me],
  );

  const setSaved = useCallback(
    async (kind: SavedKind, id: string, saved: boolean, opts?: { quiet?: boolean }) => {
      if (!userId) return;
      const field = kind === "BOOK" ? "savedBookIds" : "savedEpisodeIds";
      const apply = (cur: { me: Me | null } | undefined): { me: Me | null } => {
        if (!cur?.me) return cur ?? { me: null };
        const rest = cur.me[field].filter((x) => x !== id);
        return { me: { ...cur.me, [field]: saved ? [id, ...rest] : rest } };
      };
      try {
        await mutate<{ me: Me | null }>(
          keys.me,
          async (cur) => {
            const res = await gql<{ setSaved: Pick<Me, "savedBookIds" | "savedEpisodeIds"> }>(SET_SAVED_MUTATION, { kind, id, saved });
            return cur?.me ? { me: { ...cur.me, ...res.setSaved } } : (cur ?? { me: null });
          },
          { optimisticData: apply, rollbackOnError: true, revalidate: false },
        );
        if (!opts?.quiet) {
          toast.show({
            message: saved ? "Saved to My List" : "Removed from My List",
            action: { label: "Undo", onClick: () => void setSaved(kind, id, !saved, { quiet: true }) },
          });
        }
      } catch (err) {
        const message = (err as Error).message ?? "";
        toast.show({
          tone: "error",
          message: /full/i.test(message)
            ? "My List is full. Remove something to make room."
            : /unknown id/i.test(message)
              ? "This isn’t available anymore."
              : "Couldn’t save. Check your connection.",
          action: /full|unknown id/i.test(message) ? undefined : { label: "Retry", onClick: () => void setSaved(kind, id, saved, opts) },
        });
      }
    },
    [userId, mutate, toast],
  );

  const toggle = useCallback((kind: SavedKind, id: string) => setSaved(kind, id, !isSaved(kind, id)), [setSaved, isSaved]);

  return useMemo(
    () => ({ bookIds: me?.savedBookIds ?? [], episodeIds: me?.savedEpisodeIds ?? [], isSaved, setSaved, toggle }),
    [me, isSaved, setSaved, toggle],
  );
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** navigator.onLine (true during server rendering). */
export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
