import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { EpisodeProgress, ProgressMap } from '@/data/types';
import { authClient } from '@/lib/auth-client';
import { readUserJson, writeUserJson } from '@/lib/user-files';

/** Seconds of episode watched per local calendar day, keyed `YYYY-MM-DD`. */
export type WatchActivity = Record<string, number>;

/**
 * Largest forward step between two position updates that still counts as watching. The player reports
 * whole seconds, so normal playback moves 1–2s per update (up to 2× speed); anything bigger is a seek.
 */
const MAX_WATCH_STEP_SEC = 3;

/** Position updates arrive every second while playing; the file is rewritten at most this often. */
const SAVE_DELAY_MS = 3000;

/** Local calendar day as `YYYY-MM-DD`. */
export function dayKey(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

type ProgressContextValue = {
  progress: ProgressMap;
  activity: WatchActivity;
  get: (episodeId: string) => EpisodeProgress | undefined;
  setPosition: (episodeId: string, positionSec: number) => void;
  markCompleted: (episodeId: string) => void;
};

type ProgressState = { progress: ProgressMap; activity: WatchActivity };

const EMPTY: ProgressState = { progress: {}, activity: {} };
const FILE = 'progress';

const ProgressContext = createContext<ProgressContextValue | null>(null);

/**
 * Watch progress per episode and seconds watched per day for the signed-in user. There's no API for
 * progress yet, so it's kept on this device only (`users/<id>/progress.json`, see user-files.ts).
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; data: ProgressState }>(() => ({
    userId,
    data: userId ? readUserJson(userId, FILE, EMPTY) : EMPTY,
  }));

  // Another account on this device: load its own progress (adjusted while rendering, React's pattern for derived state)
  if (state.userId !== userId) {
    setState({ userId, data: userId ? readUserJson(userId, FILE, EMPTY) : EMPTY });
  }

  // Save shortly after changes, and right away when the user changes or the provider unmounts
  const pendingSave = useRef<{ userId: string; data: ProgressState } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const save = pendingSave.current;
    pendingSave.current = null;
    if (save) writeUserJson(save.userId, FILE, save.data);
  }, []);
  useEffect(() => flush, [flush, userId]);

  const update = useCallback(
    (change: (prev: ProgressState) => ProgressState) => {
      setState((prev) => {
        const data = change(prev.data);
        if (data === prev.data || !prev.userId) return data === prev.data ? prev : { ...prev, data };
        pendingSave.current = { userId: prev.userId, data };
        if (!timer.current) timer.current = setTimeout(flush, SAVE_DELAY_MS);
        return { ...prev, data };
      });
    },
    [flush],
  );

  const setPosition = useCallback(
    (episodeId: string, positionSec: number) => {
      update((prev) => {
        const current = prev.progress[episodeId];
        if (current?.positionSec === positionSec) return prev;
        const progress = { ...prev.progress, [episodeId]: { ...current, completed: current?.completed ?? false, positionSec } };
        // Only small forward steps are playback; jumps either way are seeks and don't count as watching
        const step = positionSec - (current?.positionSec ?? 0);
        if (step <= 0 || step > MAX_WATCH_STEP_SEC) return { ...prev, progress };
        const today = dayKey(new Date());
        return { progress, activity: { ...prev.activity, [today]: (prev.activity[today] ?? 0) + step } };
      });
    },
    [update],
  );

  const markCompleted = useCallback(
    (episodeId: string) => {
      // Rewatching starts from the top next time
      update((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          [episodeId]: { positionSec: 0, completed: true, completedAt: new Date().toISOString() },
        },
      }));
    },
    [update],
  );

  const data = state.userId === userId ? state.data : EMPTY;
  const value = useMemo<ProgressContextValue>(
    () => ({
      progress: data.progress,
      activity: data.activity,
      get: (id) => data.progress[id],
      setPosition,
      markCompleted,
    }),
    [data, setPosition, markCompleted],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}
