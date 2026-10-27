import { Pressable } from 'react-native';

import { Icon } from '@/components/mintsy/icon';
import { ProgressBar } from '@/components/mintsy/progress-bar';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { Book, Episode, EpisodeProgress } from '@/data/mock';
import { episodeFraction, episodeLabel, minutesLeft } from '@/lib/series';

type ContinueCardProps = {
  book: Book;
  episode: Episode;
  entry: EpisodeProgress | undefined;
  onPress: () => void;
};

/** 236×133 "Continue watching" card with a progress bar along the bottom. */
export function ContinueCard({ book, episode, entry, onPress }: ContinueCardProps) {
  const label = `${episodeLabel(episode, book)} · ${minutesLeft(episode, entry?.positionSec ?? 0)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Resume ${book.title}, ${episode.title}. ${label}`}
      onPress={onPress}
      className="w-[236px] gap-2.5 active:opacity-80"
    >
      <Box style={{ backgroundColor: book.tint }} className="h-[133px] overflow-hidden rounded-xl">
        <Text className="absolute left-3.5 top-3 font-display text-[13px] tracking-[1px] text-on-tint">
          CH. {episode.number}
        </Text>
        <Text
          numberOfLines={2}
          className="absolute bottom-[18px] left-3.5 right-[60px] font-display text-[17px] leading-[20px] text-on-tint"
        >
          {episode.title}
        </Text>
        <Box className="absolute bottom-3.5 right-3 h-[38px] w-[38px] items-center justify-center rounded-full bg-scrim/70">
          <Icon name="play" size={14} className="text-on-scrim" />
        </Box>
        <ProgressBar
          value={episodeFraction(episode, entry)}
          trackClassName="bg-on-scrim/20"
          className="absolute bottom-0 left-0 right-0"
        />
      </Box>
      <VStack className="gap-[3px]">
        <Text numberOfLines={1} className="font-inter-semibold text-[15px] text-foreground">
          {book.title}
        </Text>
        <Text numberOfLines={1} className="font-inter text-[13px] text-muted-foreground">
          {label}
        </Text>
      </VStack>
    </Pressable>
  );
}
