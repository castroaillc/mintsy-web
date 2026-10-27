import { useState } from 'react';

import { BrandButton } from '@/components/mintsy/brand-button';
import { CoverTile } from '@/components/mintsy/cover-tile';
import { OnboardingShell, SecondaryAction } from '@/components/mintsy/onboarding-shell';
import { RadioCard } from '@/components/mintsy/radio-card';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useOnboarding } from '@/lib/onboarding';
import { recommendForInterests } from '@/lib/recommend';
import { formatRuntime, totalRuntime } from '@/lib/series';

export default function FirstSeriesStep() {
  const { data, complete } = useOnboarding();
  const picks = recommendForInterests(data.interests);
  const [selectedId, setSelectedId] = useState(picks[0].book.id);
  const selected = picks.find((p) => p.book.id === selectedId)!.book;

  // Finishing flips the root guard to the app; the app layout then opens the episode
  return (
    <OnboardingShell
      step={4}
      title="Start your first series"
      subtitle="Picked from your interests. You can add more later."
      backHref="/onboarding/reminders"
      footerDivider={false}
      footer={
        <>
          <BrandButton
            label="Start Episode 1"
            icon="play"
            height={54}
            onPress={() => complete(selected.episodes[0].id)}
          />
          <SecondaryAction label="Browse all series instead" onPress={() => complete()} />
        </>
      }
    >
      <VStack accessibilityRole="radiogroup" accessibilityLabel="First series" className="mt-6 gap-3">
        {picks.map(({ book, reason }) => {
          const meta = `${book.episodes.length} episodes · ${formatRuntime(totalRuntime(book))}`;
          return (
            <RadioCard
              key={book.id}
              checked={book.id === selectedId}
              onPress={() => setSelectedId(book.id)}
              accessibilityLabel={`${book.title} by ${book.author}. ${reason}. ${meta}`}
              className="p-3"
            >
              <CoverTile book={book} width={72} />
              <VStack className="min-w-0 flex-1 gap-1">
                <Text className="font-inter-semibold text-[12px] text-brand">{reason}</Text>
                <Text className="font-inter-semibold text-[16px] leading-[20px] text-foreground">{book.title}</Text>
                <Text className="font-inter text-[13px] text-muted-foreground">{book.author}</Text>
                <Text className="font-inter text-[13px] text-muted-foreground">{meta}</Text>
              </VStack>
            </RadioCard>
          );
        })}
      </VStack>
    </OnboardingShell>
  );
}
