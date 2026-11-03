import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHinge } from 'expo-hinge';
import { StatusBar } from 'expo-status-bar';
import { VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  type LayoutRectangle,
  type ScrollViewInstance,
} from 'react-native';
import { ReservedRegionsProvider, useReservedRegions } from 'react-native-reserved-regions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandButton } from '@/components/mintsy/brand-button';
import { EpisodeThumb } from '@/components/mintsy/episode-thumb';
import { Icon } from '@/components/mintsy/icon';
import { IconButton } from '@/components/mintsy/icon-button';
import { Scrubber } from '@/components/mintsy/scrubber';
import { SegmentedProgress } from '@/components/mintsy/segmented-progress';
import { SplitArrangement } from '@/components/mintsy/split-arrangement';
import { TranscriptList } from '@/components/mintsy/transcript-list';
import { UnderlineTabs } from '@/components/mintsy/underline-tabs';
import { BenefitList, BlockedEpisodeCard } from '@/components/premium/premium-parts';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FREE_EPISODES, type Book, type Episode } from '@/data/types';
import { usePlaybackClock, type PlaybackClock, type PlaybackClockOptions } from '@/hooks/use-playback-clock';
import { useVideoClock } from '@/hooks/use-video-clock';
import { READABLE_MAX_WIDTH, supportsArrangementView, useWideLayout } from '@/hooks/use-wide-layout';
import { useCatalog } from '@/lib/catalog';
import { useDownloads } from '@/lib/downloads';
import { followPhoneOrientation, lockPortrait } from '@/lib/orientation';
import { usePreferences } from '@/lib/preferences';
import { isEpisodeLocked, openPaywall, usePremium } from '@/lib/premium';
import { useProgress } from '@/lib/progress';
import { useSaved } from '@/lib/saved';
import { activeLineIndex, episodeLabel, episodeStatus, formatTime } from '@/lib/series';
import { streamSources } from '@/lib/stream-source';

const TABS = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'takeaways', label: 'Key takeaways' },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** Mockup panel height (390×260 on the reference phone). */
const PANEL_HEIGHT = 260;

/** Clear band (pt) kept on each side of a half-folded device's fold; nothing tappable sits in it. */
const FOLD_CLEARANCE = 24;

/**
 * Below this window height (pt), landscape means a phone on its side: the video fills the screen.
 * Covers iPhone Duo open (669) and leaves full-size iPad windows (744 and up) on the split layout.
 */
const SIDEWAYS_MAX_HEIGHT = 700;

/** Below this window height (pt), landscape has no status bar: regular iPhones and iPhone Duo folded. */
const PHONE_SIDEWAYS_MAX_HEIGHT = 500;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Switch episodes in place so the modal stays open. */
function goToEpisode(episode: Episode) {
  router.setParams({ episodeId: episode.id });
}

export default function PlayerScreen() {
  // Per screen, not per episode, so autoplaying the next episode doesn't snap back to portrait
  useFocusEffect(
    useCallback(() => {
      followPhoneOrientation();
      return lockPortrait;
    }, []),
  );

  return (
    <>
      {/* Video player: keep system bars horizontal (no iPhone Duo rail). Constant for this screen. */}
      <StatusBar verticalBarBehaviorIOS="disabled" />
      <PlayerRoute />
    </>
  );
}

function PlayerRoute() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const catalog = useCatalog();
  const found = catalog.findEpisode(episodeId);
  const { isPremium } = usePremium();
  const local = useDownloads().getLocal(episodeId);

  // Downloaded and still Premium: play the file on the device (also offline). The catalog's copy wins for
  // the text when it has it; the downloaded snapshot covers offline and episodes since removed from the catalog.
  if (local && isPremium) {
    const fromCatalog = found && !found.episode.locked ? found : null;
    const book = fromCatalog?.book ?? local.book;
    const episode = fromCatalog ? { ...fromCatalog.episode, thumbnailUrl: local.episode.thumbnailUrl } : local.episode;
    return (
      <ReservedRegionsProvider style={{ flex: 1 }}>
        <VideoEpisodePlayer key={episode.id} book={book} episode={episode} source={local.videoUri} />
      </ReservedRegionsProvider>
    );
  }

  // Downloaded but Premium has lapsed: the file stays on the device but needs Premium to play
  if (local && !found) return <Redirect href={{ pathname: '/paywall', params: { episodeId } }} />;

  if (!found) {
    const offline = catalog.status === 'error';
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Center className="flex-1 gap-4 px-8">
          <Text className="text-center font-display text-[20px] text-foreground">
            {offline ? 'This episode isn’t downloaded' : 'Episode not found'}
          </Text>
          {offline ? (
            <Text className="text-center font-inter text-[15px] text-muted-foreground">
              Connect to the internet to watch it, or pick one from Downloads.
            </Text>
          ) : null}
          <BrandButton label="Close" onPress={close} className="self-stretch" />
        </Center>
      </SafeAreaView>
    );
  }
  // Remount per episode so the clock and transcript start fresh
  const { book, episode } = found;
  const stream = streamSources(episode);

  // Never play a locked episode, however it was opened (deep link, Up next, Continue watching)
  if (isEpisodeLocked(episode, isPremium)) {
    if (!isPremium) return <Redirect href={{ pathname: '/paywall', params: { episodeId: episode.id } }} />;
    return <UnlockingEpisode key={episode.id} episode={episode} />;
  }
  // Full-screen provider: the fold's frame comes back in screen coordinates
  return (
    <ReservedRegionsProvider style={{ flex: 1 }}>
      {stream ? (
        <VideoEpisodePlayer key={episode.id} book={book} episode={episode} source={stream.source} fallback={stream.fallback} />
      ) : (
        <SimulatedEpisodePlayer key={episode.id} book={book} episode={episode} />
      )}
    </ReservedRegionsProvider>
  );
}

type PlayerProps = { book: Book; episode: Episode };

/**
 * Premium on the device but the catalog still says locked (the backend hasn't seen the purchase yet):
 * sync once, then the catalog update swaps in the real player. Never plays the locked episode.
 */
function UnlockingEpisode({ episode }: { episode: Episode }) {
  const { refresh } = usePremium();
  const [syncing, setSyncing] = useState(true);
  const runSync = () => refresh().finally(() => setSyncing(false));
  const sync = () => {
    setSyncing(true);
    runSync();
  };
  // Sync once when shown
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void runSync(), []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Center className="flex-1 gap-4 px-8">
        <Text className="text-center font-display text-[20px] text-foreground">
          {syncing ? `Unlocking Episode ${episode.number}…` : `Episode ${episode.number} isn’t unlocked yet`}
        </Text>
        <Text className="text-center font-inter text-[15px] text-muted-foreground">
          {syncing ? 'Syncing your Premium access.' : 'Your Premium access is still syncing. Try again in a moment.'}
        </Text>
        <BrandButton label="Try again" loading={syncing} onPress={sync} className="self-stretch" />
        <BrandButton label="Close" variant="outline" onPress={close} className="self-stretch" />
      </Center>
    </SafeAreaView>
  );
}

/** Clock options shared by real and simulated playback: resume point, speed preference, end-of-episode handling. */
function useClockOptions({ book, episode }: PlayerProps, onLockedNext: () => void): PlaybackClockOptions {
  const { progress, markCompleted } = useProgress();
  const prefs = usePreferences();
  const { isPremium } = usePremium();
  const next = book.episodes[episode.number];

  // Resume where the viewer left off; watched or new episodes start at 0
  const [startSec] = useState(() => {
    const entry = progress[episode.id];
    return episodeStatus(entry) === 'in-progress' ? entry!.positionSec : 0;
  });

  return {
    durationSec: episode.durationSec,
    startSec,
    initialSpeed: prefs.defaultSpeed,
    onEnd: () => {
      markCompleted(episode.id);
      // Free tier: the end of the last free episode upsells instead of auto-advancing into a locked one
      if (next && isEpisodeLocked(next, isPremium)) onLockedNext();
      else if (next && prefs.autoplayNext) goToEpisode(next);
    },
  };
}

function VideoEpisodePlayer({ source, fallback, ...props }: PlayerProps & { source: string; fallback?: string | null }) {
  const [upsell, setUpsell] = useState(false);
  const { player, ...clock } = useVideoClock(source, useClockOptions(props, () => setUpsell(true)), fallback);
  return (
    <>
      <Player {...props} clock={clock} video={player} />
      {upsell ? <EndOfFreeUpsell {...props} onDismiss={() => setUpsell(false)} /> : null}
    </>
  );
}

/** Episodes without an uploaded video yet run on a simulated clock. */
function SimulatedEpisodePlayer(props: PlayerProps) {
  const [upsell, setUpsell] = useState(false);
  const clock = usePlaybackClock(useClockOptions(props, () => setUpsell(true)));
  return (
    <>
      <Player {...props} clock={clock} video={null} />
      {upsell ? <EndOfFreeUpsell {...props} onDismiss={() => setUpsell(false)} /> : null}
    </>
  );
}

/** Opens the next episode, or the paywall (in place of the player) when it's Premium-only. */
function useGoToEpisode() {
  const { isPremium } = usePremium();
  return (episode: Episode) =>
    isEpisodeLocked(episode, isPremium) ? openPaywall(episode.id, { replace: true }) : goToEpisode(episode);
}

/**
 * Shown over the player when the last free episode ends and the next one is Premium-only.
 * Not designed; built from the paywall's pieces (blocked-episode card, benefits, 56pt CTA).
 */
function EndOfFreeUpsell({ book, episode, onDismiss }: PlayerProps & { onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const { progress } = useProgress();
  const next = book.episodes[episode.number];
  if (!next) return null;
  const freeWatched = book.episodes.filter((e) => e.number <= FREE_EPISODES && progress[e.id]?.completed).length;

  return (
    <Box
      accessibilityViewIsModal
      style={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        paddingLeft: insets.left + 24,
        paddingRight: insets.right + 24,
      }}
      className="absolute bottom-0 left-0 right-0 top-0 bg-background"
    >
      <ScrollView contentContainerClassName="min-h-full items-center justify-center py-4">
        <VStack style={{ maxWidth: READABLE_MAX_WIDTH }} className="w-full gap-[18px]">
          <BlockedEpisodeCard book={book} episode={next} freeWatched={freeWatched} />
          <Text accessibilityRole="header" className="mt-2 font-display text-[30px] leading-[33px] tracking-[-0.6px] text-foreground">
            Episode {next.number} is part of Premium<Text className="text-brand">.</Text>
          </Text>
          <Text className="font-inter text-[16px] leading-[24px] text-muted-foreground">
            Every episode of every book. Free accounts get the first {FREE_EPISODES} episodes of each series.
          </Text>
          <BenefitList />
          <VStack className="mt-2">
            <BrandButton label="Continue with Premium" height={56} onPress={() => openPaywall(next.id, { replace: true })} />
            <Pressable accessibilityRole="button" onPress={onDismiss} className="mt-1.5 h-11 items-center justify-center active:opacity-70">
              <Text className="font-inter-medium text-[15px] text-muted-foreground">Not now</Text>
            </Pressable>
          </VStack>
        </VStack>
      </ScrollView>
    </Box>
  );
}

function Player({ book, episode, clock, video }: PlayerProps & { clock: PlaybackClock; video: VideoPlayer | null }) {
  const insets = useSafeAreaInsets();
  const { progress, setPosition, saveNow, sync } = useProgress();
  const prefs = usePreferences();
  const { isPremium } = usePremium();
  const goTo = useGoToEpisode();

  // Layout is picked per render so folding, rotating and Split View switch it without losing state
  const { wide, landscape, height } = useWideLayout();
  const hinge = useHinge();
  const fold = useReservedRegions().find((r) => r.kind === 'division' && r.frame.width > r.frame.height);
  const tabletop = hinge?.status === 'partiallyOpen' && fold !== undefined;
  const sideways = landscape && height < SIDEWAYS_MAX_HEIGHT && !tabletop;
  // Below iOS 27.1 ArrangementView has no container, so wide windows keep the phone layout there
  const split = wide && !sideways && supportsArrangementView();

  const index = episode.number - 1;
  const prev = book.episodes[index - 1];
  const next = book.episodes[index + 1];

  // Track whole seconds so Browse and Book stay current; the API gets them about every 10 s while playing
  const wholeSec = Math.floor(clock.positionSec);
  useEffect(() => {
    if (wholeSec > 0 && wholeSec < episode.durationSec) setPosition(episode.id, wholeSec);
  }, [wholeSec, episode.id, episode.durationSec, setPosition]);
  // Save right away on pause, and on leaving the player (then reload Continue watching for Home)
  useEffect(() => {
    if (!clock.playing) saveNow();
  }, [clock.playing, saveNow]);
  useEffect(() => () => void sync(), [sync]);

  /** Seeks and saves the new position at once. */
  const seekTo = (sec: number) => {
    clock.seek(sec);
    const target = Math.floor(Math.min(episode.durationSec, Math.max(0, sec)));
    if (target < episode.durationSec) setPosition(episode.id, target, { saveNow: true });
  };

  const [tab, setTab] = useState<Tab>('transcript');
  const [captions, setCaptions] = useState(prefs.captionsByDefault);
  const [expanded, setExpanded] = useState(false);
  const fullScreen = expanded || sideways;
  const { isSaved, toggle } = useSaved();
  const saved = isSaved('EPISODE', episode.id);
  const activeIndex = activeLineIndex(episode, clock.positionSec);

  // ── Follow-along: keep the active line in view until the viewer scrolls ──
  // One transcript scroll view is mounted at a time (phone page or wide side pane); they share these refs
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [following, setFollowing] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(0);
  const transcriptY = useRef(0);
  const lineLayouts = useRef<Record<number, Pick<LayoutRectangle, 'y' | 'height'>>>({});

  const scrollToActive = (animated = true) => {
    const line = lineLayouts.current[activeIndex];
    if (!line || !viewportHeight) return;
    // Sit the active line about a third of the way down the viewport
    const y = transcriptY.current + line.y - viewportHeight / 3 + line.height / 2;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated });
  };

  useEffect(() => {
    if (following && tab === 'transcript') scrollToActive();
    // scrollToActive reads refs; re-run only when the active line, mode or layout changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, following, tab, split, viewportHeight]);

  const seekToLine = (sec: number) => {
    seekTo(sec);
    setFollowing(true);
  };

  const watchedFlags = book.episodes.map((e) => !!progress[e.id]?.completed);

  /** Video (or tint), plus captions or the chapter title, inset from the given edges. */
  const videoLayer = (left: number, right: number, top: number) => (
    <>
      {video ? (
        <VideoView
          player={video}
          nativeControls={false}
          contentFit="contain"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
      ) : null}

      {/* Captions take the place of the chapter title while they're on; the title only shows without video */}
      <VStack style={{ left, right, top }} className="absolute gap-2">
        {captions ? (
          <Text
            accessibilityLiveRegion="polite"
            className="self-start rounded-md bg-scrim/80 px-2.5 py-1.5 font-inter-medium text-[15px] leading-[21px] text-on-scrim"
          >
            {episode.transcript[activeIndex]?.text}
          </Text>
        ) : video ? null : (
          <>
            <Text className="font-display text-[13px] tracking-[1.4px] text-on-tint/85">CHAPTER {episode.number}</Text>
            <Text numberOfLines={3} className="max-w-[250px] font-display text-[30px] leading-[32px] text-on-tint">
              {episode.title}
            </Text>
          </>
        )}
      </VStack>
    </>
  );

  const closeButton = (
    <IconButton icon="collapse" iconSize={22} accessibilityLabel="Close player and return to series" onPress={close} />
  );

  const viewButtons = (
    <HStack className="gap-2">
      <IconButton
        icon="captions"
        accessibilityLabel={captions ? 'Hide captions' : 'Show captions'}
        selected={captions}
        className={captions ? 'border-2 border-brand' : ''}
        onPress={() => setCaptions((c) => !c)}
      />
      {sideways ? null : (
        <IconButton
          icon="fullscreen"
          accessibilityLabel={expanded ? 'Exit full screen' : 'Full screen'}
          onPress={() => setExpanded((x) => !x)}
        />
      )}
    </HStack>
  );

  const playButton = (size: number, iconSize: number) => (
    <IconButton
      icon={clock.playing ? 'pause' : 'play'}
      variant="brand"
      size={size}
      iconSize={iconSize}
      accessibilityLabel={clock.playing ? 'Pause' : 'Play'}
      onPress={clock.toggle}
    />
  );

  /** Previous · −10 · play · +10 · next, for the roomier wide and tabletop layouts. */
  const transport = (buttonSize: number, playSize: number) => (
    <>
      <IconButton
        icon="previous"
        variant="surface"
        size={buttonSize}
        iconSize={18}
        accessibilityLabel="Previous episode"
        disabled={!prev}
        onPress={() => prev && goTo(prev)}
      />
      <IconButton icon="back10" variant="surface" size={buttonSize} accessibilityLabel="Back 10 seconds" onPress={() => seekTo(clock.positionSec - 10)} />
      {playButton(playSize, playSize > 80 ? 30 : 24)}
      <IconButton icon="forward10" variant="surface" size={buttonSize} accessibilityLabel="Forward 10 seconds" onPress={() => seekTo(clock.positionSec + 10)} />
      <IconButton
        icon="next"
        variant="surface"
        size={buttonSize}
        iconSize={18}
        accessibilityLabel="Next episode"
        disabled={!next}
        onPress={() => next && goTo(next)}
      />
    </>
  );

  const seriesLink = (
    <Pressable
      accessibilityRole="link"
      accessibilityHint="Opens the series"
      onPress={() => {
        close();
        router.navigate({ pathname: '/book/[id]', params: { id: book.id } });
      }}
      hitSlop={{ top: 12, bottom: 12 }}
      className="self-start"
    >
      <Text className="font-inter text-[14px] text-muted-foreground">
        {book.title} · {book.author}
      </Text>
    </Pressable>
  );

  const speedButton = (
    <ControlButton accessibilityLabel={`Playback speed ${clock.speed}×`} onPress={clock.cycleSpeed}>
      <Text className="font-inter-semibold text-[14px] text-foreground tabular-nums">{clock.speed}×</Text>
    </ControlButton>
  );

  const saveButton = (
    <ControlButton
      accessibilityLabel={saved ? 'Remove episode from My List' : 'Save episode to My List'}
      selected={saved}
      onPress={() => toggle('EPISODE', episode.id)}
    >
      <Icon name={saved ? 'bookmarkFilled' : 'bookmark'} size={16} className={saved ? 'text-brand' : 'text-foreground'} />
      <Text className="font-inter-medium text-[14px] text-foreground">{saved ? 'Saved' : 'Save'}</Text>
    </ControlButton>
  );

  const nextLocked = !!next && isEpisodeLocked(next, isPremium);
  const upNextCard = next ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Up next: ${nextLocked ? 'Premium, ' : ''}${episodeLabel(next, book)}, ${next.title}`}
      onPress={() => goTo(next)}
      className="flex-row items-center gap-3.5 rounded-[14px] border border-border bg-card p-3 active:opacity-80"
    >
      <EpisodeThumb episode={next} size="sm" locked={nextLocked} />
      <VStack className="min-w-0 flex-1 gap-[3px]">
        <Text className="font-inter-semibold text-[12px] text-muted-foreground">
          {nextLocked ? 'Premium · ' : ''}
          {episodeLabel(next, book)}
        </Text>
        <Text numberOfLines={2} className="font-inter-semibold text-[15px] leading-[19px] text-foreground">
          {next.title}
        </Text>
      </VStack>
    </Pressable>
  ) : null;

  const tabContent =
    tab === 'transcript' ? (
      <Box onLayout={(e) => (transcriptY.current = e.nativeEvent.layout.y)}>
        <TranscriptList
          lines={episode.transcript}
          activeIndex={activeIndex}
          following={following}
          onSeek={seekToLine}
          onLineLayout={(i, y, height) => {
            lineLayouts.current[i] = { y, height };
          }}
        />
      </Box>
    ) : (
      <VStack className="gap-3 px-5 pt-4">
        {episode.takeaways.map((text, i) => (
          <HStack key={i} className="gap-3.5 rounded-[14px] border border-border bg-card p-4">
            <Box className="h-7 w-7 items-center justify-center rounded-full bg-brand">
              <Text className="font-inter-semibold text-[13px] text-brand-foreground">{i + 1}</Text>
            </Box>
            <Text className="flex-1 font-inter text-[15px] leading-[23px] text-foreground">{text}</Text>
          </HStack>
        ))}
      </VStack>
    );

  const backToCurrent =
    !following && tab === 'transcript' ? (
      <Box pointerEvents="box-none" style={{ bottom: insets.bottom + 16 }} className="absolute left-0 right-0 items-center">
        <Pressable
          accessibilityRole="button"
          onPress={() => setFollowing(true)}
          className="h-11 flex-row items-center gap-1.5 rounded-full bg-foreground px-4 active:opacity-80"
        >
          <Icon name="arrowDown" size={14} className="text-background" />
          <Text className="font-inter-semibold text-[14px] text-background">Back to current</Text>
        </Pressable>
      </Box>
    ) : null;

  // ── Tabletop (half folded, horizontal fold): video above the fold, controls and "Now" card below ──
  if (tabletop && fold) {
    const videoTop = insets.top + 16;
    const controlsTop = fold.frame.y + fold.frame.height + FOLD_CLEARANCE;
    const nextLine = episode.transcript[activeIndex + 1]?.text;
    return (
      <Box className="flex-1 bg-background">
        <Box
          style={{
            top: videoTop,
            left: insets.left + 24,
            right: insets.right + 24,
            height: Math.max(0, fold.frame.y - FOLD_CLEARANCE - videoTop),
            backgroundColor: book.tint,
          }}
          className="absolute overflow-hidden rounded-[18px]"
        >
          {videoLayer(40, 40, 72)}
          <Box className="absolute left-3.5 top-3.5">{closeButton}</Box>
          <Box className="absolute right-3.5 top-3.5">{viewButtons}</Box>
        </Box>

        {/* Nothing tappable within FOLD_CLEARANCE of the fold */}
        <VStack
          style={{ top: controlsTop, left: insets.left + 32, right: insets.right + 32, bottom: insets.bottom + 28 }}
          className="absolute gap-5"
        >
          <HStack className="items-end justify-between gap-4">
            <VStack className="min-w-0 flex-1 gap-1">
              <Text className="font-inter-semibold text-[13px] text-brand">{episodeLabel(episode, book)}</Text>
              <Text accessibilityRole="header" numberOfLines={1} className="font-display text-[24px] text-foreground">
                {episode.title}
              </Text>
            </VStack>
            {speedButton}
          </HStack>
          <Scrubber tone="surface" positionSec={clock.positionSec} durationSec={episode.durationSec} onSeek={seekToLine} />
          <HStack className="items-center justify-center gap-7">{transport(60, 88)}</HStack>
          <VStack
            accessibilityLiveRegion="polite"
            className="flex-1 justify-center gap-2.5 rounded-[18px] border border-border bg-card px-[22px] py-[18px]"
          >
            <Text className="font-inter-semibold text-[12px] uppercase tracking-[1.2px] text-muted-foreground">
              Now · {formatTime(clock.positionSec)}
            </Text>
            <Text className="font-inter-semibold text-[22px] leading-[32px] text-foreground">
              {episode.transcript[activeIndex]?.text}
            </Text>
            {nextLine ? <Text className="font-inter text-[17px] leading-[25px] text-faint">{nextLine}</Text> : null}
          </VStack>
        </VStack>
      </Box>
    );
  }

  // ── Wide (open, iOS 27.1+): video and controls beside transcript, arranged by the system ──
  if (split && !expanded) {
    const videoColumn = (
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-5">
        <Box style={{ aspectRatio: 16 / 9, backgroundColor: book.tint }} className="w-full overflow-hidden rounded-2xl">
          {videoLayer(32, 32, 72)}
          <HStack className="absolute left-0 right-0 top-0 justify-between p-3">
            {closeButton}
            {viewButtons}
          </HStack>
          <Box className="absolute bottom-2 left-5 right-5">
            <Scrubber positionSec={clock.positionSec} durationSec={episode.durationSec} onSeek={seekToLine} />
          </Box>
        </Box>

        <HStack className="items-start justify-between gap-5">
          <VStack className="min-w-0 flex-1 gap-1.5">
            <Text className="font-inter-semibold text-[13px] text-brand">{episodeLabel(episode, book)}</Text>
            <Text accessibilityRole="header" className="font-display text-[28px] leading-[31px] text-foreground">
              {episode.title}
            </Text>
            {seriesLink}
            <SegmentedProgress watched={watchedFlags} currentIndex={index} className="mt-1" />
          </VStack>
          {saveButton}
        </HStack>

        <HStack className="items-center justify-center gap-[18px] py-2">
          {transport(52, 72)}
          {speedButton}
        </HStack>

        {upNextCard ? (
          <VStack className="gap-3">
            <Text accessibilityRole="header" className="font-display text-[18px] text-foreground">
              Up next
            </Text>
            {upNextCard}
          </VStack>
        ) : null}
      </ScrollView>
    );

    const transcriptPane = (
      <Box className="flex-1 p-5 pl-0">
        <Box className="flex-1 overflow-hidden rounded-2xl border border-border bg-card">
          <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} uniformWeight />
          <Box className="flex-1">
            <ScrollView
              ref={scrollRef}
              onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
              onScrollBeginDrag={() => setFollowing(false)}
              contentContainerClassName="pb-6"
            >
              {tabContent}
            </ScrollView>
            {backToCurrent}
          </Box>
        </Box>
      </Box>
    );

    return (
      <Box
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}
        className="flex-1 bg-background"
      >
        <SplitArrangement
          primary={<Box className="flex-1">{videoColumn}</Box>}
          secondary={transcriptPane}
          primaryWidth={{ minWidth: 420, idealWidth: 616, maxWidth: 680 }}
          secondaryMinWidth={320}
        />
      </Box>
    );
  }

  // ── Phone (also folded, and wide windows below iOS 27.1) ──
  // Controls stay on screen, as in the mockup: close/captions/fullscreen top, transport bottom right.
  // The video tint runs edge to edge; controls add the side insets.
  // Full screen reaches the bottom edge, so the controls clear the home indicator
  const controlsBottom = fullScreen ? insets.bottom : 0;
  // A phone on its side has the camera cutout on one short edge and nothing above the video. Insets can
  // still report portrait values just after rotating, so use the largest one for both sides.
  // iPhone Duo open keeps its status bar along the top, so it uses the real insets.
  const phoneSideways = sideways && height < PHONE_SIDEWAYS_MAX_HEIGHT;
  const sideInset = phoneSideways ? Math.max(insets.left, insets.right, insets.top) : 0;
  const safeLeft = phoneSideways ? sideInset : insets.left;
  const safeRight = phoneSideways ? sideInset : insets.right;
  // Full screen runs the panel to the top edge, so no background shows above it
  const controlsTop = fullScreen && !phoneSideways ? insets.top : 0;
  const panel = (
    <Box
      style={[{ backgroundColor: book.tint }, fullScreen ? { flex: 1 } : { height: PANEL_HEIGHT }]}
      className="w-full overflow-hidden"
    >
      {videoLayer(safeLeft + 24, safeRight + 24, controlsTop + 70)}

      <HStack
        style={{ paddingLeft: safeLeft + 12, paddingRight: safeRight + 12, paddingTop: controlsTop + 12 }}
        className="absolute left-0 right-0 top-0 justify-between pb-3"
      >
        {closeButton}
        {viewButtons}
      </HStack>

      <HStack style={{ right: safeRight + 20, bottom: controlsBottom + 44 }} className="absolute items-center gap-3.5">
        <IconButton icon="back10" accessibilityLabel="Back 10 seconds" onPress={() => seekTo(clock.positionSec - 10)} />
        {playButton(60, 22)}
        <IconButton icon="forward10" accessibilityLabel="Forward 10 seconds" onPress={() => seekTo(clock.positionSec + 10)} />
      </HStack>

      <Box style={{ left: safeLeft + 16, right: safeRight + 16, bottom: controlsBottom }} className="absolute">
        <Scrubber positionSec={clock.positionSec} durationSec={episode.durationSec} onSeek={seekToLine} />
      </Box>
    </Box>
  );

  return (
    <Box style={{ paddingTop: fullScreen ? 0 : insets.top }} className="flex-1 bg-background">
      {fullScreen ? <StatusBar style="light" /> : null}
      {panel}

      {fullScreen ? null : (
        <Box className="flex-1">
          <ScrollView
            ref={scrollRef}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
            onScrollBeginDrag={() => setFollowing(false)}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 32,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            }}
          >
            <VStack className="gap-1.5 px-5 pt-[18px]">
              <Text className="font-inter-semibold text-[13px] text-brand">{episodeLabel(episode, book)}</Text>
              <Text accessibilityRole="header" className="font-display text-[24px] leading-[28px] text-foreground">
                {episode.title}
              </Text>
              {seriesLink}
              <SegmentedProgress watched={watchedFlags} currentIndex={index} className="mt-1" />
            </VStack>

            <HStack className="gap-2 px-5 pt-4">
              <ControlButton
                accessibilityLabel="Previous episode"
                disabled={!prev}
                onPress={() => prev && goTo(prev)}
              >
                <Icon name="previous" size={18} className="text-foreground" />
              </ControlButton>
              {speedButton}
              {saveButton}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next episode"
                accessibilityState={{ disabled: !next }}
                disabled={!next}
                onPress={() => next && goTo(next)}
                className={`ml-auto h-11 flex-row items-center gap-1.5 rounded-[10px] bg-foreground px-3.5 active:opacity-80 ${
                  next ? '' : 'opacity-40'
                }`}
              >
                <Text className="font-inter-semibold text-[14px] text-background">Next</Text>
                <Icon name="next" size={16} className="text-background" />
              </Pressable>
            </HStack>

            <Box className="mt-[22px]">
              <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} uniformWeight />
            </Box>

            {tabContent}

            {upNextCard ? (
              <VStack className="gap-3 px-5 pt-[26px]">
                <Text accessibilityRole="header" className="font-display text-[18px] text-foreground">
                  Up next
                </Text>
                {upNextCard}
              </VStack>
            ) : null}
          </ScrollView>

          {backToCurrent}
        </Box>
      )}
    </Box>
  );
}

type ControlButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  children: React.ReactNode;
};

function ControlButton({ accessibilityLabel, onPress, disabled, selected, children }: ControlButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={`h-11 min-w-12 flex-row items-center justify-center gap-1.5 rounded-[10px] border border-input bg-card px-3.5 active:opacity-70 ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      {children}
    </Pressable>
  );
}
