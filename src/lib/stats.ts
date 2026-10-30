import type { Book, ProgressMap } from '@/data/types';
import { findEpisodeIn } from '@/lib/catalog';
import { dayKey, type WatchActivity } from '@/lib/progress';

/** A day counts toward the streak once this much has been watched. */
const STREAK_MIN_SEC = 60;

function daysBefore(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Consecutive days with at least a minute watched, ending today, or yesterday when nothing's been
 * watched yet today (the streak isn't broken until the day is over).
 * Activity is kept on the device (see ProgressProvider) until the API stores it.
 */
export function streakDays(activity: WatchActivity, today = new Date()) {
  const watched = (date: Date) => (activity[dayKey(date)] ?? 0) >= STREAK_MIN_SEC;
  let offset = watched(today) ? 0 : 1;
  let streak = 0;
  while (watched(daysBefore(today, offset))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

export function learningStats(books: Book[], progress: ProgressMap, activity: WatchActivity) {
  let episodesWatched = 0;
  let seconds = 0;
  for (const [episodeId, entry] of Object.entries(progress)) {
    const found = findEpisodeIn(books, episodeId);
    if (!found) continue;
    if (entry.completed) {
      episodesWatched += 1;
      seconds += found.episode.durationSec;
    } else {
      seconds += entry.positionSec;
    }
  }
  return { streakDays: streakDays(activity), episodesWatched, timeLearning: formatHoursMinutes(seconds) };
}

/** 3720 → "1h 2m" */
export function formatHoursMinutes(totalSec: number) {
  const min = Math.round(totalSec / 60);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Time watched on each of the last 7 days ending today, oldest first, labelled by weekday. */
export function weekActivity(activity: WatchActivity, today = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = daysBefore(today, 6 - i);
    const seconds = activity[dayKey(date)] ?? 0;
    return { seconds, minutes: seconds / 60, label: DAY_LETTERS[date.getDay()], isToday: i === 6 };
  });
}
