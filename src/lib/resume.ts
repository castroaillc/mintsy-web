import type { Book, Episode, EpisodeProgress } from "./types";

export type Resume = {
  episode: Episode;
  /** in-progress = has a saved position; next = the next unwatched one; again = everything watched. */
  kind: "start" | "in-progress" | "next" | "again";
  positionSec: number;
};

/**
 * Where "Play / Resume" goes for a book: the most recently watched episode if it isn't finished, else the
 * first episode after it that isn't completed (same rule as the API's continueWatching).
 */
export function resumePoint(book: Book, progress: EpisodeProgress[]): Resume | null {
  const eps = [...book.episodes].sort((a, b) => a.number - b.number);
  if (!eps.length) return null;
  if (!progress.length) return { episode: eps[0], kind: "start", positionSec: 0 };

  const latest = [...progress].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const latestEp = eps.find((e) => e.number === latest.episodeNumber);
  if (latestEp && !latest.completed && latest.positionSec > 0) {
    return { episode: latestEp, kind: "in-progress", positionSec: latest.positionSec };
  }
  const done = new Set(progress.filter((p) => p.completed).map((p) => p.episodeNumber));
  const after = eps.find((e) => e.number > latest.episodeNumber && !done.has(e.number));
  const anyLeft = after ?? eps.find((e) => !done.has(e.number));
  if (anyLeft) {
    const p = progress.find((x) => x.episodeNumber === anyLeft.number);
    return { episode: anyLeft, kind: p && p.positionSec > 0 && !p.completed ? "in-progress" : "next", positionSec: p?.positionSec ?? 0 };
  }
  return { episode: eps[0], kind: "again", positionSec: 0 };
}

/** The resume point from a continueWatching entry, when the book has one. */
export function resumeFromEntry(book: Book, entry: EpisodeProgress | undefined): Resume | null {
  if (!entry) return null;
  const episode = book.episodes.find((e) => e.number === entry.episodeNumber);
  if (!episode) return null;
  return { episode, kind: entry.positionSec > 0 ? "in-progress" : "next", positionSec: entry.positionSec };
}
