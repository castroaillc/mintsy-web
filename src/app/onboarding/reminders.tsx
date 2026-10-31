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
  // The first playable book's second episode (or its first, for one-episode books) reads like a "next up".
  const book = books.find((b) => b.episodes.length > 0);
  const episode = book?.episodes[1] ?? book?.episodes[0];
  // While the catalog loads (or if it failed / is empty) show a generic notification so the hero never collapses
  const title = book && episode ? `${episodeLabel(episode, book)} is ready` : 'Your next episode is ready';
  const body =
    book && episode
      ? `${episode.title} · ${Math.round(episode.durationSec / 60)} min`
      : 'Tap to start watching · 5 min';
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={book ? { backgroundColor: book.tint } : undefined}
      className={`h-[210px] items-center justify-center rounded-[22px] px-5 ${book ? '' : 'bg-brand/10'}`}
    >
      <HStack
        style={{ boxShadow: '0 14px 30px rgba(0, 0, 0, 0.4)' }}
        className="w-full max-w-[300px] gap-3 rounded-[18px] border border-input bg-surface-raised/95 p-3.5"
      >
        <Wordmark variant="tile" size={38} />
        <VStack className="min-w-0 flex-1 gap-[3px]">
          <HStack className="justify-between">
            <Text className="font-inter-semibold text-[12px] text-secondary-foreground">mintsy</Text>
            <Text className="font-inter text-[12px] text-muted-foreground">now</Text>
          </HStack>
          <Text numberOfLines={1} className="font-inter-semibold text-[14px] text-foreground">
            {title}
          </Text>
          <Text numberOfLines={2} className="font-inter text-[13px] leading-[18px] text-secondary-foreground">
            {body}
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
            layout="column"
            className="h-[72px] min-w-0 flex-1 rounded-[14px] px-1.5"
          >
            <Text numberOfLines={1} className="w-full text-center font-inter text-[13px] text-muted-foreground">
              {option.label}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              className="w-full text-center font-inter-semibold text-[16px] text-foreground"
            >
              {option.time}
            </Text>
          </RadioCard>
        ))}
      </HStack>
    </OnboardingShell>
  );
}
