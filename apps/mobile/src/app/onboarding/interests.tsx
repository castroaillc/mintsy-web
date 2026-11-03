import { router } from 'expo-router';
import { useState } from 'react';

import { BrandButton } from '@/components/mintsy/brand-button';
import { OnboardingShell } from '@/components/mintsy/onboarding-shell';
import { SelectChip } from '@/components/mintsy/select-chip';
import { HStack } from '@/components/ui/hstack';
import { INTERESTS, MIN_INTERESTS, type Interest } from '@/data/interests';
import { useOnboarding } from '@/lib/onboarding';

const NEXT = '/onboarding/daily-time';

export default function InterestsStep() {
  const { data, markStep } = useOnboarding();
  const [picked, setPicked] = useState<Interest[]>(data.interests);

  const remaining = MIN_INTERESTS - picked.length;
  const toggle = (interest: Interest) =>
    setPicked((cur) => (cur.includes(interest) ? cur.filter((i) => i !== interest) : [...cur, interest]));

  return (
    <OnboardingShell
      step={1}
      title="What do you want to learn about?"
      subtitle={`Pick at least ${MIN_INTERESTS}. We’ll use them to suggest series for you.`}
      onSkip={() => {
        markStep(1);
        router.push(NEXT);
      }}
      footer={
        <BrandButton
          label={remaining > 0 ? `Pick ${remaining} more` : `Continue · ${picked.length} selected`}
          height={54}
          disabled={remaining > 0}
          onPress={() => {
            markStep(1, { interests: picked });
            router.push(NEXT);
          }}
        />
      }
    >
      <HStack className="mt-7 flex-wrap gap-2.5">
        {INTERESTS.map((interest) => (
          <SelectChip
            key={interest}
            label={interest}
            selected={picked.includes(interest)}
            onPress={() => toggle(interest)}
          />
        ))}
      </HStack>
    </OnboardingShell>
  );
}
