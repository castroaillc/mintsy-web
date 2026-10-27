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
