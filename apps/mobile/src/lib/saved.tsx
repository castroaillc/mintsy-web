import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { authClient } from '@/lib/auth-client';
import { graphql } from '@/lib/graphql';
import { promptAccount } from '@/lib/guest';

/** GraphQL `SavedKind`. */
export type SavedKind = 'BOOK' | 'EPISODE';

/** Saved ids, most recently saved first (the API's order). */
export type SavedLists = { bookIds: string[]; episodeIds: string[] };

type SavedUser = { savedBookIds: string[]; savedEpisodeIds: string[] };

const ME_SAVED_QUERY = `#graphql
  query MeSaved { me { savedBookIds savedEpisodeIds } }
`;
const SET_SAVED_MUTATION = `#graphql
  mutation SetSaved($kind: SavedKind!, $id: ID!, $saved: Boolean!) {
    setSaved(kind: $kind, id: $id, saved: $saved) { savedBookIds savedEpisodeIds }
  }
`;

const EMPTY: SavedLists = { bookIds: [], episodeIds: [] };

function fromUser(user: SavedUser): SavedLists {
  return { bookIds: user.savedBookIds, episodeIds: user.savedEpisodeIds };
}

const listKey = (kind: SavedKind) => (kind === 'BOOK' ? 'bookIds' : 'episodeIds');

/** `lists` with `id` saved (moved to the front) or removed. */
function apply(lists: SavedLists, kind: SavedKind, id: string, saved: boolean): SavedLists {
  const key = listKey(kind);
  const rest = lists[key].filter((x) => x !== id);
  return { ...lists, [key]: saved ? [id, ...rest] : rest };
}

type SavedContextValue = SavedLists & {
  /** True once the signed-in user's lists have loaded (or failed to). */
  loaded: boolean;
  isSaved: (kind: SavedKind, id: string) => boolean;
  /** Optimistic: updates at once, rolls back with an alert if the API call fails. Guests are asked to sign in instead. */
  setSaved: (kind: SavedKind, id: string, saved: boolean) => void;
  toggle: (kind: SavedKind, id: string) => void;
  /** Re-reads the lists from the API (pull to refresh). */
  reload: () => Promise<void>;
};

const SavedContext = createContext<SavedContextValue | null>(null);

/**
 * My List: series and episodes the signed-in user saved, stored by the API (`me.savedBookIds`,
 * `me.savedEpisodeIds`, `setSaved`). Empty while signed out, where saving asks for an account; a new user starts
 * from their own lists.
 */
export function SavedProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; lists: SavedLists; loaded: boolean }>({
    userId: null,
    lists: EMPTY,
    loaded: false,
  });
  // Mutations still in flight; the server's answer only replaces local state once none are pending
  const pending = useRef(0);
  const userRef = useRef(userId);
  useEffect(() => {
    userRef.current = userId;
  }, [userId]);

  const reload = useCallback(async () => {
    const forUser = userRef.current;
    if (!forUser) return;
    try {
      const data = await graphql<{ me: SavedUser | null }>(ME_SAVED_QUERY);
      if (userRef.current !== forUser || pending.current > 0) return;
      setState({ userId: forUser, lists: data.me ? fromUser(data.me) : EMPTY, loaded: true });
    } catch (err) {
      console.warn('Failed to load My List', err);
      if (userRef.current === forUser) {
        setState((prev) => (prev.userId === forUser ? { ...prev, loaded: true } : { userId: forUser, lists: EMPTY, loaded: true }));
      }
    }
  }, []);

  // Sign-in or switching accounts: load the new user's lists (the old ones are hidden as soon as the user changes)
  useEffect(() => {
    pending.current = 0;
    if (userId) reload();
  }, [userId, reload]);

  const setSaved = useCallback((kind: SavedKind, id: string, saved: boolean) => {
    const forUser = userRef.current;
    if (!forUser) {
      // Guests have no list to save to: offer an account, then they can tap Save again
      promptAccount('save');
      return;
    }
    setState((prev) => {
      const base = prev.userId === forUser ? prev : { userId: forUser, lists: EMPTY, loaded: false };
      return { ...base, lists: apply(base.lists, kind, id, saved) };
    });
    pending.current += 1;
    graphql<{ setSaved: SavedUser }>(SET_SAVED_MUTATION, { kind, id, saved })
      .then((data) => {
        pending.current -= 1;
        if (userRef.current !== forUser || pending.current > 0) return;
        setState((prev) => ({ ...prev, lists: fromUser(data.setSaved) }));
      })
      .catch((err) => {
        pending.current -= 1;
        console.warn('setSaved failed', err);
        if (userRef.current !== forUser) return;
        // Undo just this change; other toggles made meanwhile stay
        setState((prev) => ({ ...prev, lists: apply(prev.lists, kind, id, !saved) }));
        const message = (err as Error).message ?? '';
        Alert.alert(
          saved ? 'Couldn’t save' : 'Couldn’t remove',
          /full/i.test(message)
            ? 'My List is full. Remove something to make room.'
            : /unknown id/i.test(message)
              ? 'This isn’t available anymore.'
              : 'We couldn’t update My List. Check your connection and try again.',
        );
      });
  }, []);

  const value = useMemo<SavedContextValue>(() => {
    const lists = state.userId === userId ? state.lists : EMPTY;
    const isSaved = (kind: SavedKind, id: string) => lists[listKey(kind)].includes(id);
    return {
      ...lists,
      loaded: state.userId === userId && state.loaded,
      isSaved,
      setSaved,
      toggle: (kind, id) => setSaved(kind, id, !isSaved(kind, id)),
      reload,
    };
  }, [state, userId, setSaved, reload]);

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used within SavedProvider');
  return ctx;
}
