import { router } from 'expo-router';
import { useState } from 'react';

import { BrandButton } from '@/components/mintsy/brand-button';
import { OnboardingShell } from '@/components/mintsy/onboarding-shell';
import { RadioCard } from '@/components/mintsy/radio-card';
import { Center } from '@/components/ui/center';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { DAILY_GOALS, type DailyGoal } from '@/data/interests';
import { useOnboarding } from '@/lib/onboarding';

const NEXT = '/onboarding/reminders';
const EPISODE_MINUTES = 5;
const SAMPLE_CHAPTERS = 20;

function estimate(minutes: DailyGoal) {
  if (!minutes) return 'No pressure. Your progress is saved after every episode.';
  const days = Math.ceil(SAMPLE_CHAPTERS / (minutes / EPISODE_MINUTES));
  return `At ${minutes} minutes a day, you’d finish a ${SAMPLE_CHAPTERS}-chapter book in about ${days} ${days === 1 ? 'day' : 'days'}.`;
}

export default function DailyTimeStep() {
  const { data, markStep } = useOnboarding();
  const [goal, setGoal] = useState<DailyGoal>(data.dailyGoal);

  return (
    <OnboardingShell
      step={2}
      title="How much time do you have each day?"
      subtitle="Episodes are about 5 minutes. You can change this anytime."
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
        {DAILY_GOALS.map((option) => (
          <RadioCard
            key={option.minutes}
            checked={goal === option.minutes}
            onPress={() => setGoal(option.minutes)}
            accessibilityLabel={`${option.title}, ${option.sub}`}
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
              <Text className="font-inter text-[14px] text-muted-foreground">{option.sub}</Text>
            </VStack>
          </RadioCard>
        ))}
      </VStack>
      <Text accessibilityLiveRegion="polite" className="mt-5 font-inter text-[14px] leading-[21px] text-secondary-foreground">
        {estimate(goal)}
      </Text>
    </OnboardingShell>
  );
}
