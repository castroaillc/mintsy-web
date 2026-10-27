import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandButton } from '@/components/mintsy/brand-button';
import { Chip } from '@/components/mintsy/chip-row';
import { CoverTile } from '@/components/mintsy/cover-tile';
import { EpisodeRow } from '@/components/mintsy/episode-row';
import { Icon, type IconName } from '@/components/mintsy/icon';
import { IconButton } from '@/components/mintsy/icon-button';
import { ProgressBar } from '@/components/mintsy/progress-bar';
import { UnderlineTabs } from '@/components/mintsy/underline-tabs';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getBook, type Book, type Episode } from '@/data/mock';
import { useProgress } from '@/lib/progress';
import { episodeLabel, formatRuntime, formatTime, nextEpisode, totalRuntime, watchedCount } from '@/lib/series';

const RANGE_SIZE = 10;
const TABS = [
  { value: 'episodes', label: 'Episodes' },
  { value: 'transcripts', label: 'Transcripts' },
  { value: 'about', label: 'About the book' },
] as const;
type Tab = (typeof TABS)[number]['value'];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function openPlayer(episodeId: string) {
  router.push({ pathname: '/player/[episodeId]', params: { episodeId } });
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const book = getBook(id);

  if (!book) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Center className="flex-1 gap-4 px-8">
          <Text className="font-display text-[20px] text-foreground">Book not found</Text>
          <BrandButton label="Back to browse" onPress={goBack} className="self-stretch" />
        </Center>
      </SafeAreaView>
    );
  }
  return <BookDetail book={book} />;
}

function BookDetail({ book }: { book: Book }) {
  const insets = useSafeAreaInsets();
  const { progress } = useProgress();
  const listRef = useRef<FlatList<Episode>>(null);

  const total = book.episodes.length;
  const primary = nextEpisode(book, progress);
  const watched = watchedCount(book, progress);
  const ranges = Array.from({ length: Math.ceil(total / RANGE_SIZE) }, (_, i) => i * RANGE_SIZE);

  const [tab, setTab] = useState<Tab>('episodes');
  const [rangeStart, setRangeStart] = useState(
    Math.floor((primary.episode.number - 1) / RANGE_SIZE) * RANGE_SIZE,
  );
  // Like the mockup, open with the in-progress episode's transcript preview showing
  const [expandedId, setExpandedId] = useState<string | null>(primary.resume ? primary.episode.id : null);
  const [saved, setSaved] = useState(false);

  const rangeEpisodes = book.episodes.slice(rangeStart, rangeStart + RANGE_SIZE);
  const data = tab === 'about' ? [] : rangeEpisodes;

  const showTranscript = (episode: Episode) => {
    setTab('transcripts');
    const index = rangeEpisodes.indexOf(episode);
    // Wait a frame for the transcript items to render before scrolling
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, viewOffset: insets.top + 8 }));
  };

  const header = (
    <VStack>
      <Box
        style={{ backgroundColor: book.tint, height: 330 + insets.top, paddingTop: insets.top }}
        className="items-center justify-end pb-7"
      >
        <HStack style={{ top: insets.top + 16 }} className="absolute left-3 right-3 justify-between">
          <IconButton icon="back" iconSize={22} accessibilityLabel="Back to browse" onPress={goBack} />
          <IconButton
            icon="share"
            accessibilityLabel="Share"
            onPress={() => Share.share({ message: `${book.title} by ${book.author} on mintsy` })}
          />
        </HStack>
        <CoverTile book={book} width={150} />
      </Box>

      <VStack className="gap-3 px-5 pt-[22px]">
        <Text accessibilityRole="header" className="font-display text-[28px] leading-[31px] tracking-[-0.4px] text-foreground">
          {book.title}
        </Text>
        <Text className="font-inter text-[15px] text-muted-foreground">{book.author}</Text>
        <HStack className="flex-wrap gap-2">
          {[`${total} episodes`, formatRuntime(totalRuntime(book)), book.category, 'Transcripts'].map((tag) => (
            <Box key={tag} className="h-7 justify-center rounded-lg bg-tag px-2.5">
              <Text className="font-inter text-[13px] text-secondary-foreground">{tag}</Text>
            </Box>
          ))}
        </HStack>

        <BrandButton
          label={`${primary.resume ? 'Resume' : 'Play'} ${episodeLabel(primary.episode, book)}`}
          icon="play"
          height={52}
          onPress={() => openPlayer(primary.episode.id)}
          className="mt-1.5"
        />

        <HStack className="gap-2">
          <ActionTile
            icon={saved ? 'check' : 'plus'}
            label="My List"
            selected={saved}
            onPress={() => setSaved((s) => !s)}
          />
          <ActionTile icon="download" label="Download" />
          <ActionTile icon="transcript" label="Full transcript" onPress={() => setTab('transcripts')} />
        </HStack>

        <VStack className="mt-1 gap-2">
          <HStack className="justify-between">
            <Text className="font-inter text-[13px] text-muted-foreground">
              {watched} of {total} episodes watched
            </Text>
            <Text className="font-inter text-[13px] text-muted-foreground">{Math.round((watched / total) * 100)}%</Text>
          </HStack>
          <ProgressBar value={watched / total} height={6} rounded />
        </VStack>

        <Text className="mt-1.5 font-inter text-[15px] leading-[23px] text-secondary-foreground">{book.description}</Text>
      </VStack>

      <Box className="mt-[26px]">
        <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} />
      </Box>

      {tab !== 'about' ? (
        <HStack className="items-center justify-between gap-2 px-5 pb-1.5 pt-[18px]">
          <HStack className="flex-wrap gap-2">
            {ranges.length > 1
              ? ranges.map((start) => (
                  <Chip
                    key={start}
                    compact
                    label={`Chapters ${start + 1}–${Math.min(total, start + RANGE_SIZE)}`}
                    selected={start === rangeStart}
                    onPress={() => setRangeStart(start)}
                  />
                ))
              : null}
          </HStack>
          <Text className="font-inter text-[13px] text-muted-foreground">~5 min each</Text>
        </HStack>
      ) : null}
    </VStack>
  );

  return (
    <Box className="flex-1 bg-background">
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(e) => e.id}
        extraData={[expandedId, progress, tab]}
        ListHeaderComponent={header}
        ListFooterComponent={tab === 'about' ? <AboutTab book={book} /> : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewOffset: insets.top + 8 }), 100);
        }}
        renderItem={({ item }) =>
          tab === 'episodes' ? (
            <EpisodeRow
              book={book}
              episode={item}
              entry={progress[item.id]}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
              onPlay={() => openPlayer(item.id)}
              onReadTranscript={() => showTranscript(item)}
            />
          ) : (
            <TranscriptBlock book={book} episode={item} />
          )
        }
      />
    </Box>
  );
}

type ActionTileProps = { icon: IconName; label: string; selected?: boolean; onPress?: () => void };

function ActionTile({ icon, label, selected, onPress }: ActionTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      className="h-16 flex-1 items-center justify-center gap-[5px] rounded-xl border border-input bg-card active:opacity-70"
    >
      <Icon name={icon} size={20} className={selected ? 'text-brand' : 'text-foreground'} />
      <Text className="font-inter-medium text-[12px] text-foreground">{label}</Text>
    </Pressable>
  );
}

function TranscriptBlock({ book, episode }: { book: Book; episode: Episode }) {
  return (
    <VStack className="gap-2.5 border-b border-border px-5 py-5">
      <HStack className="items-center justify-between gap-3">
        <VStack className="flex-1 gap-0.5">
          <Text className="font-inter-semibold text-[12px] text-muted-foreground">{episodeLabel(episode, book)}</Text>
          <Text className="font-inter-semibold text-[16px] text-foreground">{episode.title}</Text>
        </VStack>
        <IconButton
          icon="play"
          variant="surface"
          iconSize={16}
          accessibilityLabel={`Play ${episode.title}`}
          onPress={() => openPlayer(episode.id)}
        />
      </HStack>
      {episode.transcript.map((line) => (
        <HStack key={line.startSec} className="gap-3">
          <Text className="w-10 font-inter-semibold text-[14px] leading-[21px] text-brand tabular-nums">
            {formatTime(line.startSec)}
          </Text>
          <Text className="flex-1 font-inter text-[14px] leading-[21px] text-secondary-foreground">{line.text}</Text>
        </HStack>
      ))}
    </VStack>
  );
}

function AboutTab({ book }: { book: Book }) {
  const facts = [
    ['Author', book.author],
    ['Category', book.category],
    ['Episodes', `${book.episodes.length} chapters, about 5 minutes each`],
    ['Total runtime', formatRuntime(totalRuntime(book))],
  ];
  return (
    <VStack className="gap-4 px-5 pt-5">
      <Text className="font-inter text-[15px] leading-[23px] text-secondary-foreground">{book.description}</Text>
      <VStack className="rounded-[14px] border border-border bg-card px-4">
        {facts.map(([label, value], i) => (
          <HStack key={label} className={`justify-between gap-4 py-3.5 ${i > 0 ? 'border-t border-border' : ''}`}>
            <Text className="font-inter text-[14px] text-muted-foreground">{label}</Text>
            <Text className="flex-1 text-right font-inter-medium text-[14px] text-foreground">{value}</Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
