import { Pressable } from 'react-native';

import { BrandButton } from '@/components/mintsy/brand-button';
import { EpisodeThumb } from '@/components/mintsy/episode-thumb';
import { Icon } from '@/components/mintsy/icon';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { Book, Episode, EpisodeProgress } from '@/data/mock';
import { episodeFraction, episodeLabel, episodeStatus, formatTime, minutesLeft } from '@/lib/series';

type EpisodeRowProps = {
  book: Book;
  episode: Episode;
  entry: EpisodeProgress | undefined;
  expanded: boolean;
  onToggle: () => void;
  onPlay: () => void;
  onReadTranscript: () => void;
};

const CTA = { watched: 'Watch again', 'in-progress': 'Resume', unwatched: 'Play episode' } as const;

/** Episode list row that expands inline into a transcript preview with actions. */
export function EpisodeRow({ book, episode, entry, expanded, onToggle, onPlay, onReadTranscript }: EpisodeRowProps) {
  const status = episodeStatus(entry);
  const label = episodeLabel(episode, book);
  const meta =
    status === 'watched'
      ? `Watched · ${label}`
      : status === 'in-progress'
        ? `${minutesLeft(episode, entry?.positionSec ?? 0)} · ${label}`
        : label;
  const highlighted = status !== 'unwatched';

  return (
    <Box className="border-b border-border px-5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${meta}. ${episode.title}. ${episode.summary}`}
        accessibilityHint={expanded ? 'Collapses the transcript preview' : 'Shows a transcript preview'}
        onPress={onToggle}
        className="flex-row gap-3.5 py-3.5"
      >
        <EpisodeThumb episode={episode} progress={episodeFraction(episode, entry)} />
        <VStack className="min-w-0 flex-1 gap-1">
          <HStack className="items-center gap-1.5">
            {status === 'watched' ? <Icon name="check" size={14} className="text-brand" /> : null}
            <Text
              numberOfLines={1}
              className={`font-inter-semibold text-[12px] ${highlighted ? 'text-brand' : 'text-muted-foreground'}`}
            >
              {meta}
            </Text>
          </HStack>
          <Text numberOfLines={2} className="font-inter-semibold text-[15px] leading-[19px] text-foreground">
            {episode.title}
          </Text>
          <Text numberOfLines={2} className="font-inter text-[13px] leading-[18px] text-muted-foreground">
            {episode.summary}
          </Text>
        </VStack>
      </Pressable>

      {expanded ? (
        <VStack className="mb-4 gap-3 rounded-[14px] border border-border bg-card p-4">
          <HStack className="items-center justify-between">
            <Text className="font-inter-semibold text-[12px] uppercase tracking-[1.2px] text-muted-foreground">
              Transcript preview
            </Text>
            <Text className="font-inter text-[12px] text-muted-foreground">{label}</Text>
          </HStack>
          {episode.transcript.slice(0, 3).map((line) => (
            <HStack key={line.startSec} className="gap-3">
              <Text className="w-10 font-inter-semibold text-[14px] leading-[21px] text-brand tabular-nums">
                {formatTime(line.startSec)}
              </Text>
              <Text className="flex-1 font-inter text-[14px] leading-[21px] text-secondary-foreground">
                {line.text}
              </Text>
            </HStack>
          ))}
          <HStack className="mt-1 gap-2">
            <BrandButton label={CTA[status]} icon="play" height={44} onPress={onPlay} className="flex-1" />
            <BrandButton label="Read transcript" variant="outline" height={44} onPress={onReadTranscript} className="flex-1" />
          </HStack>
        </VStack>
      ) : null}
    </Box>
  );
}
