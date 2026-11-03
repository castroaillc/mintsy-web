import { router } from 'expo-router';
import { useState } from 'react';

import { BrandButton } from '@/components/mintsy/brand-button';
import { OnboardingShell } from '@/components/mintsy/onboarding-shell';
import { RadioCard } from '@/components/mintsy/radio-card';
import { Center } from '@/components/ui/center';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { DAILY_GOALS, type DailyGoal } from '@/data/interests';
import { useCatalog } from '@/lib/catalog';
import { useOnboarding } from '@/lib/onboarding';
import { catalogAverages } from '@/lib/series';

const NEXT = '/onboarding/reminders';

type Averages = NonNullable<ReturnType<typeof catalogAverages>>;

/** How long an average catalog book takes at this goal, from real episode counts and lengths. */
function estimate(minutes: DailyGoal, avg: Averages | undefined) {
  if (!minutes) return 'No pressure. Your progress is saved after every episode.';
  if (!avg) return undefined;
  const days = Math.max(1, Math.ceil((avg.episodesPerBook * avg.episodeMinutes) / minutes));
  return `At ${minutes} minutes a day, you’d finish a typical ${avg.episodesPerBook}-episode series in about ${days} ${days === 1 ? 'day' : 'days'}.`;
}

/** "3 episodes a day" from the catalog's average episode length, or the goal's plain caption without one. */
function goalSub(option: (typeof DAILY_GOALS)[number], avg: Averages | undefined) {
  if (!option.minutes || !avg) return option.sub;
  const perDay = Math.max(1, Math.round(option.minutes / avg.episodeMinutes));
  return `${perDay} ${perDay === 1 ? 'episode' : 'episodes'} a day`;
}

export default function DailyTimeStep() {
  const { data, markStep } = useOnboarding();
  const [goal, setGoal] = useState<DailyGoal>(data.dailyGoal);
  const { books } = useCatalog();
  const avg = catalogAverages(books);
  const estimateText = estimate(goal, avg);

  return (
    <OnboardingShell
      step={2}
      title="How much time do you have each day?"
      subtitle={
        avg
          ? `Episodes are about ${avg.episodeMinutes} ${avg.episodeMinutes === 1 ? 'minute' : 'minutes'}. You can change this anytime.`
          : 'You can change this anytime.'
      }
      backHref="/onboarding/interests"
      onSkip={() => {
        markStep(2);
        router.push(NEXT);
      }}
      footer={
        <BrandButton
          label="Continue"
          height={54}
          onPress={() => {
            markStep(2, { dailyGoal: goal });
            router.push(NEXT);
          }}
        />
      }
    >
      <VStack accessibilityRole="radiogroup" accessibilityLabel="Daily goal" className="mt-7 gap-3">
        {DAILY_GOALS.map((option) => {
          const sub = goalSub(option, avg);
          return (
            <RadioCard
              key={option.minutes}
              checked={goal === option.minutes}
              onPress={() => setGoal(option.minutes)}
              accessibilityLabel={`${option.title}, ${sub}`}
              className="p-4"
            >
              <Center className="h-14 w-14 rounded-xl bg-tag">
                <Text className="font-display text-[20px] leading-[22px] text-foreground">
                  {option.minutes || '?'}
                </Text>
                <Text className="font-inter text-[11px] text-muted-foreground">{option.minutes ? 'min' : 'flex'}</Text>
              </Center>
              <VStack className="flex-1 gap-[3px]">
                <Text className="font-inter-semibold text-[16px] text-foreground">{option.title}</Text>
                <Text className="font-inter text-[14px] text-muted-foreground">{sub}</Text>
              </VStack>
            </RadioCard>
            );
        })}
      </VStack>
      {estimateText ? (
        <Text accessibilityLiveRegion="polite" className="mt-5 font-inter text-[14px] leading-[21px] text-secondary-foreground">
          {estimateText}
        </Text>
      ) : null}
    </OnboardingShell>
  );
}
