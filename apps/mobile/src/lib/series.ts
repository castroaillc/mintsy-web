import { EPISODE_TINTS, type Book, type Episode, type EpisodeProgress, type ProgressMap } from '@/data/types';

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

/** "1 episode", "20 episodes" (or another noun: "1 chapter"). */
export function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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

/**
 * Where Continue watching picks up in a book, by the API's rule (`continueWatching`): the most recently saved
 * episode if it isn't completed, otherwise the next one that isn't (then earlier ones). Undefined when nothing
 * has been watched or every episode is completed.
 */
export function continueEpisode(book: Book, progress: ProgressMap) {
  const started = book.episodes.filter((e) => progress[e.id]);
  if (started.length === 0) return undefined;
  const savedAt = (e: Episode) => progress[e.id]?.updatedAt ?? '';
  const latest = started.reduce((a, b) => (savedAt(b) > savedAt(a) ? b : a));
  if (!progress[latest.id]?.completed) return latest;
  const i = book.episodes.indexOf(latest);
  return [...book.episodes.slice(i + 1), ...book.episodes.slice(0, i)].find((e) => !progress[e.id]?.completed);
}

/** Every episode completed (a book with no episodes yet can't have been finished). */
export function isBookFinished(book: Book, progress: ProgressMap) {
  return book.episodes.length > 0 && watchedCount(book, progress) === book.episodes.length;
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

/** Average length of `episodes` in whole minutes (at least 1), or undefined when no durations are known. */
function averageMinutes(episodes: Episode[]) {
  const known = episodes.filter((e) => e.durationSec > 0);
  if (known.length === 0) return undefined;
  const avgSec = known.reduce((sum, e) => sum + e.durationSec, 0) / known.length;
  return Math.max(1, Math.round(avgSec / 60));
}

/** Average episode length in whole minutes (at least 1), or undefined when no durations are known. */
export function averageEpisodeMinutes(book: Book) {
  return averageMinutes(book.episodes);
}

/**
 * Catalog-wide averages over books that have at least one episode: episodes per book (rounded) and
 * episode length in whole minutes. Undefined when the catalog has no episodes with a known length.
 */
export function catalogAverages(books: Book[]) {
  const withEpisodes = books.filter((b) => b.episodes.length > 0);
  const episodeMinutes = averageMinutes(withEpisodes.flatMap((b) => b.episodes));
  if (!episodeMinutes) return undefined;
  const totalEpisodes = withEpisodes.reduce((sum, b) => sum + b.episodes.length, 0);
  return { episodesPerBook: Math.round(totalEpisodes / withEpisodes.length), episodeMinutes };
}

/** Index of the transcript line playing at `positionSec`. */
export function activeLineIndex(episode: Pick<Episode, 'transcript'>, positionSec: number) {
  let index = 0;
  episode.transcript.forEach((line, i) => {
    if (line.startSec <= positionSec) index = i;
  });
  return index;
}
