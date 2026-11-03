import type { Category } from '@/data/types';

export const INTERESTS = [
  'Finance',
  'Investing',
  'Business',
  'Leadership',
  'Psychology',
  'Productivity',
  'Health',
  'Science',
  'History',
  'Philosophy',
  'Relationships',
  'Creativity',
  'Marketing',
  'Startups',
] as const;
export type Interest = (typeof INTERESTS)[number];

export const MIN_INTERESTS = 3;

/** Which catalog category each interest draws recommendations from. */
export const INTEREST_CATEGORY: Record<Interest, Category> = {
  Finance: 'Finance',
  Investing: 'Finance',
  Business: 'Business',
  Leadership: 'Business',
  Marketing: 'Business',
  Startups: 'Business',
  Psychology: 'Psychology',
  Relationships: 'Psychology',
  Philosophy: 'Psychology',
  Productivity: 'Productivity',
  Creativity: 'Productivity',
  Health: 'Health',
  Science: 'Health',
  History: 'History',
};

/**
 * Minutes per day; 0 = no daily goal. `sub` is the fallback caption; onboarding swaps in episodes a day
 * from the catalog's real episode length when it has one.
 */
export const DAILY_GOALS = [
  { minutes: 5, title: 'Quick', sub: '5 minutes a day', short: '5 min' },
  { minutes: 15, title: 'Steady', sub: '15 minutes a day', short: '15 min' },
  { minutes: 30, title: 'Deep dive', sub: '30 minutes a day', short: '30 min' },
  { minutes: 0, title: 'I’ll decide as I go', sub: 'No daily goal', short: 'Flexible' },
] as const;
export type DailyGoal = (typeof DAILY_GOALS)[number]['minutes'];

export const REMINDER_TIMES = [
  { id: 'morning', label: 'Morning', time: '8:00 AM', hour: 8, minute: 0 },
  { id: 'lunch', label: 'Lunch', time: '12:30 PM', hour: 12, minute: 30 },
  { id: 'evening', label: 'Evening', time: '8:00 PM', hour: 20, minute: 0 },
] as const;
export type ReminderTimeId = (typeof REMINDER_TIMES)[number]['id'];

export function reminderTime(id: ReminderTimeId) {
  return REMINDER_TIMES.find((t) => t.id === id)!;
}

export function goalLabel(minutes: DailyGoal) {
  return minutes ? `${minutes} min a day` : 'No daily goal';
}
