import { Pressable } from 'react-native';

import { CoverTile } from '@/components/mintsy/cover-tile';
import { EpisodeThumb } from '@/components/mintsy/episode-thumb';
import { Icon } from '@/components/mintsy/icon';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { Book, Episode } from '@/data/types';
import { FREE_EPISODES } from '@/data/types';
import { openLegalUrl, PRIVACY_URL, SHOW_TERMS, TERMS_LABEL, TERMS_URL } from '@/lib/legal';
import type { Plan } from '@/lib/offering';

const BENEFITS = [
  { title: 'All episodes, every book.', sub: `No more stopping at Episode ${FREE_EPISODES}.` },
  { title: 'Full transcripts and key takeaways', sub: 'for every chapter.' },
  { title: 'Download for offline', sub: 'on flights and commutes.' },
];

/** "Keep going with mintsy. Premium" with the accent dot. */
export function PaywallTitle({ size = 32 }: { size?: 32 | 34 }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ fontSize: size, lineHeight: Math.round(size * 1.08) }}
      className="font-display tracking-[-0.6px] text-foreground"
    >
      Keep going with mintsy<Text className="text-brand">.</Text> Premium
    </Text>
  );
}

export function PaywallSubtitle() {
  return (
    <Text className="font-inter text-[16px] leading-[24px] text-muted-foreground">
      Every episode of every book. Free accounts get the first {FREE_EPISODES} episodes of each series.
    </Text>
  );
}

export function BenefitList() {
  return (
    <VStack className="gap-3.5">
      {BENEFITS.map((b) => (
        <HStack key={b.title} className="items-start gap-3">
          <Box className="h-6 w-6 items-center justify-center rounded-full bg-brand/15">
            <Icon name="check" size={13} className="text-brand" />
          </Box>
          <Text className="flex-1 font-inter text-[15px] leading-[21px] text-foreground">
            <Text className="font-inter-semibold text-[15px] text-foreground">{b.title}</Text>
            {b.sub ? <Text className="font-inter text-[15px] text-muted-foreground"> {b.sub}</Text> : null}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}

/** "3 free episodes watched · Episode 4 of 20 · <title> is next" above the paywall title. */
export function BlockedEpisodeCard({ book, episode, freeWatched }: { book: Book; episode: Episode; freeWatched: number }) {
  return (
    <HStack className="items-center gap-3.5 rounded-[14px] border border-border bg-card p-3">
      <CoverTile book={book} width={48} />
      <VStack className="min-w-0 flex-1 gap-1">
        <Text className="font-inter-semibold text-[12px] text-brand">
          {freeWatched > 0
            ? `${freeWatched} free episode${freeWatched === 1 ? '' : 's'} watched`
            : `First ${FREE_EPISODES} episodes are free`}
        </Text>
        <Text className="font-inter text-[14px] leading-[19px] text-foreground">
          Episode {episode.number} of {book.episodes.length} · {episode.title} is next
        </Text>
      </VStack>
    </HStack>
  );
}

type PlanCardProps = {
  plan: Plan;
  selected: boolean;
  savingsPercent: number | null;
  onPress: () => void;
  large?: boolean;
};

/** Radio card for one plan; the yearly card carries the "BEST VALUE · SAVE X%" badge. */
export function PlanCard({ plan, selected, savingsPercent, onPress, large }: PlanCardProps) {
  const yearly = plan.kind === 'yearly';
  const sub = yearly
    ? plan.perMonthString
      ? `Just ${plan.perMonthString}/month, billed yearly`
      : 'Billed every year'
    : 'Billed every month';
  const name = yearly ? 'Yearly' : 'Monthly';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${plan.priceString} per ${plan.periodNoun}. ${sub}`}
      onPress={onPress}
      className={`flex-row items-center gap-3.5 rounded-2xl border-2 ${large ? 'p-[18px]' : 'p-4'} ${
        selected ? 'border-brand bg-brand/5' : 'border-input bg-card'
      }`}
    >
      <Box
        className={`h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${selected ? 'border-brand' : 'border-ring'}`}
      >
        {selected ? <Box className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
      </Box>
      <VStack className="flex-1 gap-[3px]">
        <Text className={`font-inter-semibold ${large ? 'text-[17px]' : 'text-[16px]'} text-foreground`}>{name}</Text>
        <Text className="font-inter text-[13px] text-muted-foreground">{sub}</Text>
      </VStack>
      <Text className={`font-inter-semibold ${large ? 'text-[17px]' : 'text-[16px]'} text-foreground`}>{plan.priceString}</Text>
      {yearly ? (
        <Box className="absolute -top-[11px] right-4 h-[22px] justify-center rounded-full bg-brand px-[9px]">
          <Text className="font-inter-semibold text-[11px] tracking-[0.4px] text-brand-foreground">
            {savingsPercent ? `BEST VALUE · SAVE ${savingsPercent}%` : 'BEST VALUE'}
          </Text>
        </Box>
      ) : null}
    </Pressable>
  );
}

/** Two placeholder cards while the offering loads. */
export function PlanSkeleton({ large }: { large?: boolean }) {
  return (
    <>
      {[0, 1].map((i) => (
        <HStack
          key={i}
          accessibilityElementsHidden
          className={`items-center gap-3.5 rounded-2xl border-2 border-input bg-card ${large ? 'p-[18px]' : 'p-4'}`}
        >
          <Box className="h-[22px] w-[22px] rounded-full bg-tag" />
          <VStack className="flex-1 gap-2">
            <Box className="h-3.5 w-20 rounded bg-tag" />
            <Box className="h-3 w-44 rounded bg-tag" />
          </VStack>
          <Box className="h-4 w-14 rounded bg-tag" />
        </HStack>
      ))}
    </>
  );
}

export function LegalLinks() {
  return (
    <HStack className="items-center justify-center gap-1.5">
      {SHOW_TERMS ? (
        <>
          <Pressable accessibilityRole="link" onPress={() => openLegalUrl(TERMS_URL)} hitSlop={8}>
            <Text className="font-inter text-[12px] text-secondary-foreground underline">{TERMS_LABEL}</Text>
          </Pressable>
          <Text className="font-inter text-[12px] text-faint">·</Text>
        </>
      ) : null}
      <Pressable accessibilityRole="link" onPress={() => openLegalUrl(PRIVACY_URL)} hitSlop={8}>
        <Text className="font-inter text-[12px] text-secondary-foreground underline">Privacy Policy</Text>
      </Pressable>
    </HStack>
  );
}

/** The "m." app mark with an accent check badge (Welcome to Premium). */
export function PremiumMark({ size = 132 }: { size?: 132 | 148 }) {
  const big = size === 148;
  const badge = big ? 44 : 40;
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: big ? 38 : 34 }}
      className="items-center justify-center border border-border bg-card"
    >
      <Text
        style={{ fontSize: big ? 104 : 92, lineHeight: big ? 110 : 98, marginTop: big ? -20 : -18 }}
        className="font-display tracking-[-3px] text-foreground"
      >
        m<Text className="text-brand">.</Text>
      </Text>
      <Box
        style={{ width: badge, height: badge, top: big ? -12 : -10, right: big ? -12 : -10 }}
        className="absolute items-center justify-center rounded-full bg-brand"
      >
        <Icon name="check" size={big ? 22 : 20} className="text-brand-foreground" />
      </Box>
    </Box>
  );
}

/** Up-next card on Welcome to Premium: thumbnail, "Up next · Episode N of M", title (and book on wide). */
export function UpNextEpisodeCard({ book, episode, showBook }: { book: Book; episode: Episode; showBook?: boolean }) {
  return (
    <HStack className="items-center gap-3.5 rounded-2xl border border-border bg-card p-3">
      <EpisodeThumb episode={episode} size="sm" />
      <VStack className="min-w-0 flex-1 gap-[3px]">
        <Text className="font-inter-semibold text-[12px] text-muted-foreground">
          Up next · Episode {episode.number} of {book.episodes.length}
        </Text>
        <Text numberOfLines={2} className={`font-inter-semibold ${showBook ? 'text-[16px]' : 'text-[15px]'} text-foreground`}>
          {episode.title}
        </Text>
        {showBook ? <Text className="font-inter text-[13px] text-muted-foreground">{book.title}</Text> : null}
      </VStack>
    </HStack>
  );
}
