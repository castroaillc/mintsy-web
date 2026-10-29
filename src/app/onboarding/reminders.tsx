import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { BrandButton } from '@/components/mintsy/brand-button';
import { OnboardingShell, SecondaryAction } from '@/components/mintsy/onboarding-shell';
import { RadioCard } from '@/components/mintsy/radio-card';
import { Wordmark } from '@/components/mintsy/wordmark';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { REMINDER_TIMES, type ReminderTimeId } from '@/data/interests';
import { useCatalog } from '@/lib/catalog';
import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { useOnboarding } from '@/lib/onboarding';
import { scheduleDailyReminder } from '@/lib/reminders';
import { episodeLabel } from '@/lib/series';

const NEXT = '/onboarding/first-series';

/** Mock lock-screen notification shown above the step, previewing a real episode from the catalog. */
function NotificationPreview() {
  const { books } = useCatalog();
  // The first playable book's second episode (or its first, for one-episode books) reads like a "next up"
  const book = books.find((b) => b.episodes.length > 0);
  const episode = book?.episodes[1] ?? book?.episodes[0];
  if (!book || !episode) return null;
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ backgroundColor: book.tint }}
      className="h-[210px] items-center justify-center rounded-[22px] px-5"
    >
      <HStack
        style={{ boxShadow: '0 14px 30px rgba(0, 0, 0, 0.4)' }}
        className="w-full max-w-[300px] gap-3 rounded-[18px] border border-input bg-surface-raised/95 p-3.5"
      >
        <Wordmark variant="tile" size={38} />
        <VStack className="flex-1 gap-[3px]">
          <HStack className="justify-between">
            <Text className="font-inter-semibold text-[12px] text-secondary-foreground">mintsy</Text>
            <Text className="font-inter text-[12px] text-muted-foreground">now</Text>
          </HStack>
          <Text className="font-inter-semibold text-[14px] text-foreground">{episodeLabel(episode, book)} is ready</Text>
          <Text className="font-inter text-[13px] leading-[18px] text-secondary-foreground">
            {episode.title} · {Math.round(episode.durationSec / 60)} min
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
}

export default function RemindersStep() {
  const { data, markStep } = useOnboarding();
  const { request } = useNotificationPermission();
  const [time, setTime] = useState<ReminderTimeId>(data.reminderTime);
  const [busy, setBusy] = useState(false);

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await request();
      const granted = permission === 'granted';
      if (granted) await scheduleDailyReminder(time);
      else Alert.alert('Notifications are off', 'You can turn on reminders later in Settings.');
      markStep(3, { reminderTime: time, remindersOn: granted });
      router.push(NEXT);
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingShell
      step={3}
      title="Want a daily nudge?"
      subtitle="One reminder a day with your next episode. Change it anytime in Settings."
      backHref="/onboarding/daily-time"
      onSkip={() => {
        markStep(3);
        router.push(NEXT);
      }}
      hero={<NotificationPreview />}
      footerDivider={false}
      footer={
        <>
          <BrandButton label="Turn on reminders" height={54} loading={busy} onPress={turnOn} />
          <SecondaryAction
            label="Not now"
            onPress={() => {
              markStep(3, { reminderTime: time, remindersOn: false });
              router.push(NEXT);
            }}
          />
        </>
      }
    >
      <HStack accessibilityRole="radiogroup" accessibilityLabel="Reminder time" className="mt-[22px] gap-2.5">
        {REMINDER_TIMES.map((option) => (
          <RadioCard
            key={option.id}
            checked={time === option.id}
            onPress={() => setTime(option.id)}
            accessibilityLabel={`${option.label}, ${option.time}`}
            indicator={false}
            className="h-[72px] flex-1 flex-col justify-center gap-1 rounded-[14px]"
          >
            <Text className="font-inter text-[13px] text-muted-foreground">{option.label}</Text>
            <Text className="font-inter-semibold text-[16px] text-foreground">{option.time}</Text>
          </RadioCard>
        ))}
      </HStack>
    </OnboardingShell>
  );
}
