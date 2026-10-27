import { EPISODE_TINTS, type Book, type Episode, type EpisodeProgress, type ProgressMap } from '@/data/mock';

/** 312 → "5:12" */
export function formatTime(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** 6060 → "1 hr 41 min" */
export function formatRuntime(totalSec: number) {
  const min = Math.round(totalSec / 60);
  const hr = Math.floor(min / 60);
  return hr > 0 ? `${hr} hr ${min % 60} min` : `${min} min`;
}

export function episodeLabel(episode: Episode, book: Book) {
  return `Episode ${episode.number} of ${book.episodes.length}`;
}

export function minutesLeft(episode: Episode, positionSec: number) {
  return `${Math.max(1, Math.ceil((episode.durationSec - positionSec) / 60))} min left`;
}

export function episodeTint(episode: Episode) {
  return EPISODE_TINTS[(episode.number - 1) % EPISODE_TINTS.length];
}

export type EpisodeStatus = 'watched' | 'in-progress' | 'unwatched';

export function episodeStatus(entry: EpisodeProgress | undefined): EpisodeStatus {
  if (entry?.completed) return 'watched';
  if (entry && entry.positionSec > 0) return 'in-progress';
  return 'unwatched';
}

/** 0–1, for progress bars. Watched episodes read as full. */
export function episodeFraction(episode: Episode, entry: EpisodeProgress | undefined) {
  if (entry?.completed) return 1;
  return entry ? Math.min(1, entry.positionSec / episode.durationSec) : 0;
}

export function watchedCount(book: Book, progress: ProgressMap) {
  return book.episodes.filter((e) => progress[e.id]?.completed).length;
}

/** The latest episode with a saved position, if any. */
export function inProgressEpisode(book: Book, progress: ProgressMap) {
  return book.episodes.findLast((e) => episodeStatus(progress[e.id]) === 'in-progress');
}

/** Where the book's primary Play/Resume button should start. */
export function nextEpisode(book: Book, progress: ProgressMap) {
  const resume = inProgressEpisode(book, progress);
  if (resume) return { episode: resume, resume: true };
  const firstUnwatched = book.episodes.find((e) => !progress[e.id]?.completed);
  return { episode: firstUnwatched ?? book.episodes[0], resume: false };
}

export function totalRuntime(book: Book) {
  return book.episodes.reduce((sum, e) => sum + e.durationSec, 0);
}

/** Index of the transcript line playing at `positionSec`. */
export function activeLineIndex(episode: Episode, positionSec: number) {
  let index = 0;
  episode.transcript.forEach((line, i) => {
    if (line.startSec <= positionSec) index = i;
  });
  return index;
}
