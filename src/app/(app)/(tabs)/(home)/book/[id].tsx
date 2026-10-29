import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share } from 'react-native';
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
import type { Book, Episode } from '@/data/types';
import { useWideLayout } from '@/hooks/use-wide-layout';
import { useCatalog } from '@/lib/catalog';
import { useDownloads } from '@/lib/downloads';
import { openPaywall, useIsLocked, useOpenEpisode, usePremium } from '@/lib/premium';
import { useProgress } from '@/lib/progress';
import { useSaved } from '@/lib/saved';
import { averageEpisodeMinutes, countLabel, episodeLabel, formatRuntime, formatTime, nextEpisode, totalRuntime, watchedCount } from '@/lib/series';

const RANGE_SIZE = 10;
const TABS = [
  { value: 'episodes', label: 'Episodes' },
  { value: 'transcripts', label: 'Transcripts' },
  { value: 'about', label: 'About the book' },
] as const;
type Tab = (typeof TABS)[number]['value'];
/** The wide layout shows the book's details in the left pane, so its right pane drops the About tab. */
const WIDE_TABS = TABS.filter((t) => t.value !== 'about');

/** Left pane width of the wide (two-pane) layout. */
const WIDE_INFO_WIDTH = 456;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const book = useCatalog().getBook(id);

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

function shareBook(book: Book) {
  Share.share({ message: `${book.title} by ${book.author} on mintsy` });
}

function BookDetail({ book }: { book: Book }) {
  const insets = useSafeAreaInsets();
  const { wide } = useWideLayout();
  const { progress } = useProgress();
  const { isPremium } = usePremium();
  const isLocked = useIsLocked();
  const openEpisode = useOpenEpisode();
  const listRef = useRef<FlatList<Episode>>(null);

  const total = book.episodes.length;
  const avgMinutes = averageEpisodeMinutes(book);
  const eachLabel = avgMinutes ? (
    <Text className="font-inter text-[13px] text-muted-foreground">~{avgMinutes} min each</Text>
  ) : null;
  const primary = nextEpisode(book, progress);
  const watched = watchedCount(book, progress);
  const ranges = Array.from({ length: Math.ceil(total / RANGE_SIZE) }, (_, i) => i * RANGE_SIZE);

  const [tab, setTab] = useState<Tab>('episodes');
  const [rangeStart, setRangeStart] = useState(
    Math.floor((primary.episode.number - 1) / RANGE_SIZE) * RANGE_SIZE,
  );
  // Like the mockup, open with the in-progress episode's transcript preview showing
  const [expandedId, setExpandedId] = useState<string | null>(primary.resume ? primary.episode.id : null);
  const { isSaved, toggle } = useSaved();
  const saved = isSaved('BOOK', book.id);
  const downloads = useDownloads();

  const rangeEpisodes = book.episodes.slice(rangeStart, rangeStart + RANGE_SIZE);
  // State is shared by both layouts so folding keeps it; wide shows About in the left pane instead
  const listTab: Tab = wide && tab === 'about' ? 'episodes' : tab;
  const data = listTab === 'about' ? [] : rangeEpisodes;
  // Compact: the list scrolls under the status bar, so keep scrolled-to rows below it
  const scrollOffset = wide ? 0 : insets.top + 8;

  const showTranscript = (episode: Episode) => {
    setTab('transcripts');
    const index = rangeEpisodes.indexOf(episode);
    // Wait a frame for the transcript items to render before scrolling
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, viewOffset: scrollOffset }));
  };

  // Free tier: when the next episode is Premium-only the main button sells it instead
  const primaryLocked = isLocked(primary.episode);
  const resumeButton = (
    <BrandButton
      label={
        primaryLocked
          ? `Unlock Episode ${primary.episode.number} with Premium`
          : `${primary.resume ? 'Resume' : 'Play'} ${episodeLabel(primary.episode, book)}`
      }
      icon="play"
      height={52}
      onPress={() => openEpisode(primary.episode)}
      className="mt-1.5"
    />
  );

  // Download: the next episode to watch, else the next one after it not on the device yet
  const startIndex = book.episodes.indexOf(primary.episode);
  const ordered = [...book.episodes.slice(startIndex), ...book.episodes.slice(0, startIndex)];
  const bookDownloading = downloads.active.find((a) => a.bookId === book.id);
  const toDownload = ordered.find((e) => downloads.status(e.id) === 'none');
  const downloadTile = !isPremium ? (
    <ActionTile icon="download" label="Download" onPress={() => openPaywall(primary.episode.id)} />
  ) : bookDownloading ? (
    <ActionTile
      icon="download"
      label={bookDownloading.fraction !== null ? `${Math.round(bookDownloading.fraction * 100)}%` : 'Downloading'}
      accessibilityLabel={`Downloading ${bookDownloading.title}. Opens Downloads`}
      selected
      onPress={() => router.navigate('/downloads')}
    />
  ) : toDownload ? (
    <ActionTile
      icon="download"
      label={`Download Ep ${toDownload.number}`}
      accessibilityLabel={`Download Episode ${toDownload.number}, ${toDownload.title}`}
      onPress={() => downloads.download(book, toDownload)}
    />
  ) : (
    <ActionTile
      icon="downloaded"
      label="Downloaded"
      accessibilityLabel="All episodes downloaded. Opens Downloads"
      selected
      onPress={() => router.navigate('/downloads')}
    />
  );

  const actions = (
    <HStack className="gap-2">
      <ActionTile
        icon={saved ? 'check' : 'plus'}
        label="My List"
        accessibilityLabel={saved ? `Remove ${book.title} from My List` : `Add ${book.title} to My List`}
        selected={saved}
        onPress={() => toggle('BOOK', book.id)}
      />
      {/* Downloads and the full transcript are Premium-only */}
      {downloadTile}
      <ActionTile
        icon="transcript"
        label="Full transcript"
        selected={wide && isPremium ? listTab === 'transcripts' : undefined}
        onPress={isPremium ? () => setTab('transcripts') : () => openPaywall(primary.episode.id)}
      />
    </HStack>
  );

  const watchedProgress = (
    <VStack className="mt-1 gap-2">
      <HStack className="justify-between">
        <Text className="font-inter text-[13px] text-muted-foreground">
          {watched} of {countLabel(total, 'episode')} watched
        </Text>
        <Text className="font-inter text-[13px] text-muted-foreground">{Math.round((watched / total) * 100)}%</Text>
      </HStack>
      <ProgressBar value={watched / total} height={6} rounded />
    </VStack>
  );

  const rangePills = (
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
  );

  const renderItem = ({ item }: { item: Episode }) =>
    listTab === 'episodes' ? (
      <EpisodeRow
        book={book}
        episode={item}
        entry={progress[item.id]}
        locked={isLocked(item)}
        freeTier={!isPremium}
        expanded={expandedId === item.id}
        onToggle={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
        onPlay={() => openEpisode(item)}
        onReadTranscript={() => (isLocked(item) ? openPaywall(item.id) : showTranscript(item))}
      />
    ) : (
      <TranscriptBlock book={book} episode={item} locked={isLocked(item)} onPlay={() => openEpisode(item)} />
    );

  const onScrollToIndexFailed = (info: { index: number; averageItemLength: number }) => {
    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewOffset: scrollOffset }), 100);
  };

  // ── Wide (e.g. iPhone Duo open): details left, episodes right, each scrolling on its own ──
  if (wide) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 flex-row bg-background">
        <ScrollView
          style={{ width: WIDE_INFO_WIDTH }}
          className="flex-none"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          contentContainerClassName="gap-3.5 px-7 pt-4"
        >
          <HStack className="justify-between">
            <IconButton icon="back" variant="surface" iconSize={20} accessibilityLabel="Back to browse" onPress={goBack} />
            <IconButton icon="share" variant="surface" accessibilityLabel="Share" onPress={() => shareBook(book)} />
          </HStack>
          <HStack className="mt-1 items-end gap-[18px]">
            <CoverTile book={book} width={132} />
            <VStack className="min-w-0 flex-1 gap-2">
              <Text accessibilityRole="header" className="font-display text-[28px] leading-[30px] tracking-[-0.4px] text-foreground">
                {book.title}
              </Text>
              <Text className="font-inter text-[15px] text-muted-foreground">{book.author}</Text>
              <Text className="font-inter text-[13px] text-muted-foreground">
                {countLabel(total, 'episode')} · {formatRuntime(totalRuntime(book))} · {book.category}
              </Text>
            </VStack>
          </HStack>
          {resumeButton}
          {actions}
          {watchedProgress}
          <Text className="mt-1 font-inter text-[15px] leading-[23px] text-secondary-foreground">{book.description}</Text>
          <BookFacts book={book} />
        </ScrollView>

        <VStack className="min-w-0 flex-1 border-l border-border">
          <UnderlineTabs tabs={WIDE_TABS} value={listTab} onChange={setTab} />
          <HStack className="items-center justify-between gap-2 px-5 pb-1.5 pt-3">
            {rangePills}
            {eachLabel}
          </HStack>
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(e) => e.id}
            extraData={[expandedId, progress, listTab, isPremium]}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            onScrollToIndexFailed={onScrollToIndexFailed}
            renderItem={renderItem}
          />
        </VStack>
      </SafeAreaView>
    );
  }

  const header = (
    <VStack>
      {/* Tint runs edge to edge (cancels the list's side insets); the buttons stay clear of the rail */}
      <Box
        style={{
          backgroundColor: book.tint,
          height: 330 + insets.top,
          paddingTop: insets.top,
          marginLeft: -insets.left,
          marginRight: -insets.right,
        }}
        className="items-center justify-end pb-7"
      >
        <HStack
          style={{ top: insets.top + 16, left: insets.left + 12, right: insets.right + 12 }}
          className="absolute justify-between"
        >
          <IconButton icon="back" iconSize={22} accessibilityLabel="Back to browse" onPress={goBack} />
          <IconButton icon="share" accessibilityLabel="Share" onPress={() => shareBook(book)} />
        </HStack>
        <CoverTile book={book} width={150} />
      </Box>

      <VStack className="gap-3 px-5 pt-[22px]">
        <Text accessibilityRole="header" className="font-display text-[28px] leading-[31px] tracking-[-0.4px] text-foreground">
          {book.title}
        </Text>
        <Text className="font-inter text-[15px] text-muted-foreground">{book.author}</Text>
        <HStack className="flex-wrap gap-2">
          {[countLabel(total, 'episode'), formatRuntime(totalRuntime(book)), book.category, 'Transcripts'].map((tag) => (
            <Box key={tag} className="h-7 justify-center rounded-lg bg-tag px-2.5">
              <Text className="font-inter text-[13px] text-secondary-foreground">{tag}</Text>
            </Box>
          ))}
        </HStack>

        {resumeButton}
        {actions}
        {watchedProgress}

        <Text className="mt-1.5 font-inter text-[15px] leading-[23px] text-secondary-foreground">{book.description}</Text>
      </VStack>

      <Box className="mt-[26px]">
        <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} />
      </Box>

      {tab !== 'about' ? (
        <HStack className="items-center justify-between gap-2 px-5 pb-1.5 pt-[18px]">
          {rangePills}
          {eachLabel}
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
        extraData={[expandedId, progress, tab, isPremium]}
        ListHeaderComponent={header}
        ListFooterComponent={tab === 'about' ? <AboutTab book={book} /> : undefined}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 96,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
        onScrollToIndexFailed={onScrollToIndexFailed}
        renderItem={renderItem}
      />
    </Box>
  );
}

type ActionTileProps = {
  icon: IconName;
  label: string;
  accessibilityLabel?: string;
  selected?: boolean;
  onPress?: () => void;
};

function ActionTile({ icon, label, accessibilityLabel, selected, onPress }: ActionTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      className="h-16 flex-1 items-center justify-center gap-[5px] rounded-xl border border-input bg-card active:opacity-70"
    >
      <Icon name={icon} size={20} className={selected ? 'text-brand' : 'text-foreground'} />
      <Text numberOfLines={1} className="px-1 font-inter-medium text-[12px] text-foreground">
        {label}
      </Text>
    </Pressable>
  );
}

type TranscriptBlockProps = { book: Book; episode: Episode; locked: boolean; onPlay: () => void };

function TranscriptBlock({ book, episode, locked, onPlay }: TranscriptBlockProps) {
  return (
    <VStack className="gap-2.5 border-b border-border px-5 py-5">
      <HStack className="items-center justify-between gap-3">
        <VStack className="flex-1 gap-0.5">
          <Text className="font-inter-semibold text-[12px] text-muted-foreground">{episodeLabel(episode, book)}</Text>
          <Text className="font-inter-semibold text-[16px] text-foreground">{episode.title}</Text>
        </VStack>
        <IconButton
          icon={locked ? 'lock' : 'play'}
          variant="surface"
          iconSize={16}
          accessibilityLabel={locked ? `Unlock ${episode.title} with Premium` : `Play ${episode.title}`}
          onPress={onPlay}
        />
      </HStack>
      {locked ? (
        <HStack className="items-center gap-3">
          <Text className="flex-1 font-inter text-[14px] leading-[21px] text-muted-foreground">
            The transcript for this episode is part of Premium.
          </Text>
          <BrandButton label="Unlock with Premium" height={44} onPress={() => openPaywall(episode.id)} />
        </HStack>
      ) : null}
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
  return (
    <VStack className="gap-4 px-5 pt-5">
      <Text className="font-inter text-[15px] leading-[23px] text-secondary-foreground">{book.description}</Text>
      <BookFacts book={book} />
    </VStack>
  );
}

function BookFacts({ book }: { book: Book }) {
  const facts = [
    ['Author', book.author],
    ['Category', book.category],
    ['Episodes', `${countLabel(book.episodes.length, 'chapter')}, about 5 minutes each`],
    ['Total runtime', formatRuntime(totalRuntime(book))],
  ];
  return (
    <VStack className="rounded-[14px] border border-border bg-card px-4">
      {facts.map(([label, value], i) => (
        <HStack key={label} className={`justify-between gap-4 py-3.5 ${i > 0 ? 'border-t border-border' : ''}`}>
          <Text className="font-inter text-[14px] text-muted-foreground">{label}</Text>
          <Text className="flex-1 text-right font-inter-medium text-[14px] text-foreground">{value}</Text>
        </HStack>
      ))}
    </VStack>
  );
}
