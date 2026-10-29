import {
  cancelScheduledNotificationAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
} from 'expo-notifications';

import { reminderTime, type ReminderTimeId } from '@/data/interests';

const REMINDER_ID = 'daily-reminder';

/** Schedules (or reschedules) the one daily "next episode" nudge. */
export async function scheduleDailyReminder(timeId: ReminderTimeId) {
  const { hour, minute } = reminderTime(timeId);
  await cancelDailyReminder();
  await scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Your next episode is ready',
      body: 'Five minutes is all it takes. Pick up where you left off.',
    },
    trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export async function cancelDailyReminder() {
  await cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}

const TRIAL_REMINDER_ID = 'trial-ending';
const TRIAL_REMINDER_LEAD_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * One-off reminder 2 days before a free trial ends. Returns false (nothing scheduled) when that moment
 * has passed or notifications aren't allowed.
 */
export async function scheduleTrialEndingReminder(trialEndsAt: Date) {
  const at = new Date(trialEndsAt.getTime() - TRIAL_REMINDER_LEAD_MS);
  if (at.getTime() <= Date.now()) return false;
  try {
    await cancelScheduledNotificationAsync(TRIAL_REMINDER_ID).catch(() => {});
    await scheduleNotificationAsync({
      identifier: TRIAL_REMINDER_ID,
      content: {
        title: 'Your mintsy Premium trial ends in 2 days',
        body: 'Keep watching every episode, or cancel anytime in your store settings before it renews.',
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at },
    });
    return true;
  } catch {
    return false;
  }
}
