import { BOOKS, findEpisode, type ProgressMap } from '@/data/mock';
import { inProgressEpisode, nextEpisode, watchedCount } from '@/lib/series';

/** Mock until the API tracks daily activity: minutes watched over the last 7 days, oldest first. */
const MOCK_WEEK_MINUTES = [18, 15, 22, 6, 16, 15, 0];
const MOCK_STREAK_DAYS = 5;

export function learningStats(progress: ProgressMap) {
  let episodesWatched = 0;
  let seconds = 0;
  for (const [episodeId, entry] of Object.entries(progress)) {
    const found = findEpisode(episodeId);
    if (!found) continue;
    if (entry.completed) {
      episodesWatched += 1;
      seconds += found.episode.durationSec;
    } else {
      seconds += entry.positionSec;
    }
  }
  return { streakDays: MOCK_STREAK_DAYS, episodesWatched, timeLearning: formatHoursMinutes(seconds) };
}

/** 3720 → "1h 2m" */
export function formatHoursMinutes(totalSec: number) {
  const min = Math.round(totalSec / 60);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Last 7 days ending today, labelled by weekday. */
export function weekActivity(today = new Date()) {
  return MOCK_WEEK_MINUTES.map((minutes, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (MOCK_WEEK_MINUTES.length - 1 - i));
    return { minutes, label: DAY_LETTERS[date.getDay()], isToday: i === MOCK_WEEK_MINUTES.length - 1 };
  });
}

/** Books started but not finished, most recently relevant first. */
export function booksInProgress(progress: ProgressMap) {
  return BOOKS.filter((book) => {
    const watched = watchedCount(book, progress);
    return watched < book.episodes.length && (watched > 0 || !!inProgressEpisode(book, progress));
  }).map((book) => ({
    book,
    episode: nextEpisode(book, progress).episode,
    fraction: watchedCount(book, progress) / book.episodes.length,
  }));
}

export function finishedBooks(progress: ProgressMap) {
  return BOOKS.filter((book) => watchedCount(book, progress) === book.episodes.length);
}
