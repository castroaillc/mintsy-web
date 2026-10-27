import { createContext, useContext, useState, type ReactNode } from 'react';

import { INITIAL_PROGRESS, type EpisodeProgress, type ProgressMap } from '@/data/mock';

type ProgressContextValue = {
  progress: ProgressMap;
  get: (episodeId: string) => EpisodeProgress | undefined;
  setPosition: (episodeId: string, positionSec: number) => void;
  markCompleted: (episodeId: string) => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

/** Watch progress per episode. In memory only until there's a backend for it. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressMap>(INITIAL_PROGRESS);

  const setPosition = (episodeId: string, positionSec: number) => {
    setProgress((prev) => {
      const current = prev[episodeId];
      if (current?.positionSec === positionSec) return prev;
      return { ...prev, [episodeId]: { completed: current?.completed ?? false, positionSec } };
    });
  };

  const markCompleted = (episodeId: string) => {
    // Rewatching starts from the top next time
    setProgress((prev) => ({ ...prev, [episodeId]: { positionSec: 0, completed: true } }));
  };

  return (
    <ProgressContext.Provider value={{ progress, get: (id) => progress[id], setPosition, markCompleted }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}
