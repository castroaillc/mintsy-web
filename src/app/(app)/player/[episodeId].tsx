import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  type LayoutRectangle,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandButton } from '@/components/mintsy/brand-button';
import { EpisodeThumb } from '@/components/mintsy/episode-thumb';
import { Icon } from '@/components/mintsy/icon';
import { IconButton } from '@/components/mintsy/icon-button';
import { Scrubber } from '@/components/mintsy/scrubber';
import { SegmentedProgress } from '@/components/mintsy/segmented-progress';
import { TranscriptList } from '@/components/mintsy/transcript-list';
import { UnderlineTabs } from '@/components/mintsy/underline-tabs';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { findEpisode, type Book, type Episode } from '@/data/mock';
import { usePlaybackClock } from '@/hooks/use-playback-clock';
import { usePreferences } from '@/lib/preferences';
import { useProgress } from '@/lib/progress';
import { activeLineIndex, episodeLabel, episodeStatus } from '@/lib/series';

const TABS = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'takeaways', label: 'Key takeaways' },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** Mockup panel height (390×260 on the reference phone). */
const PANEL_HEIGHT = 260;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Switch episodes in place so the modal stays open. */
function goToEpisode(episode: Episode) {
  router.setParams({ episodeId: episode.id });
}

export default function PlayerScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const found = findEpisode(episodeId);

  if (!found) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Center className="flex-1 gap-4 px-8">
          <Text className="font-display text-[20px] text-foreground">Episode not found</Text>
          <BrandButton label="Close" onPress={close} className="self-stretch" />
        </Center>
      </SafeAreaView>
    );
  }
  // Remount per episode so the clock and transcript start fresh
  return <Player key={found.episode.id} book={found.book} episode={found.episode} />;
}

function Player({ book, episode }: { book: Book; episode: Episode }) {
  const insets = useSafeAreaInsets();
  const { progress, setPosition, markCompleted } = useProgress();
  const prefs = usePreferences();

  const index = episode.number - 1;
  const prev = book.episodes[index - 1];
  const next = book.episodes[index + 1];

  // Resume where the viewer left off; watched or new episodes start at 0
  const [startSec] = useState(() => {
    const entry = progress[episode.id];
    return episodeStatus(entry) === 'in-progress' ? entry!.positionSec : 0;
  });

  const clock = usePlaybackClock({
    durationSec: episode.durationSec,
    startSec,
    initialSpeed: prefs.defaultSpeed,
    onEnd: () => {
      markCompleted(episode.id);
      if (next && prefs.autoplayNext) goToEpisode(next);
    },
  });

  // Persist whole seconds so Browse and Book stay current
  const wholeSec = Math.floor(clock.positionSec);
  useEffect(() => {
    if (wholeSec > 0 && wholeSec < episode.durationSec) setPosition(episode.id, wholeSec);
  }, [wholeSec, episode.id, episode.durationSec, setPosition]);

  const [tab, setTab] = useState<Tab>('transcript');
  const [captions, setCaptions] = useState(prefs.captionsByDefault);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const activeIndex = activeLineIndex(episode, clock.positionSec);

  // ── Follow-along: keep the active line in view until the viewer scrolls ──
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
    // scrollToActive reads refs; re-run only when the active line or mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, following, tab]);

  const seekToLine = (sec: number) => {
    clock.seek(sec);
    setFollowing(true);
  };

  const watchedFlags = book.episodes.map((e) => !!progress[e.id]?.completed);

  // Controls stay on screen, as in the mockup: close/captions/fullscreen top, transport bottom right
  const panel = (
    <Box
      style={[{ backgroundColor: book.tint }, expanded ? { flex: 1 } : { height: PANEL_HEIGHT }]}
      className="w-full overflow-hidden"
    >
      {/* Captions take the place of the chapter title while they're on */}
      <VStack className="absolute left-6 right-6 top-[70px] gap-2">
        {captions ? (
          <Text
            accessibilityLiveRegion="polite"
            className="self-start rounded-md bg-scrim/80 px-2.5 py-1.5 font-inter-medium text-[15px] leading-[21px] text-on-scrim"
          >
            {episode.transcript[activeIndex]?.text}
          </Text>
        ) : (
          <>
            <Text className="font-display text-[13px] tracking-[1.4px] text-on-tint/85">CHAPTER {episode.number}</Text>
            <Text numberOfLines={3} className="max-w-[250px] font-display text-[30px] leading-[32px] text-on-tint">
              {episode.title}
            </Text>
          </>
        )}
      </VStack>

      <HStack className="absolute left-0 right-0 top-0 justify-between p-3">
        <IconButton icon="collapse" iconSize={22} accessibilityLabel="Close player and return to series" onPress={close} />
        <HStack className="gap-2">
          <IconButton
            icon="captions"
            accessibilityLabel={captions ? 'Hide captions' : 'Show captions'}
            selected={captions}
            className={captions ? 'border-2 border-brand' : ''}
            onPress={() => setCaptions((c) => !c)}
          />
          <IconButton
            icon="fullscreen"
            accessibilityLabel={expanded ? 'Exit full screen' : 'Full screen'}
            onPress={() => setExpanded((x) => !x)}
          />
        </HStack>
      </HStack>

      <HStack className="absolute bottom-11 right-5 items-center gap-3.5">
        <IconButton icon="back10" accessibilityLabel="Back 10 seconds" onPress={() => clock.skip(-10)} />
        <IconButton
          icon={clock.playing ? 'pause' : 'play'}
          variant="brand"
          size={60}
          iconSize={22}
          accessibilityLabel={clock.playing ? 'Pause' : 'Play'}
          onPress={clock.toggle}
        />
        <IconButton icon="forward10" accessibilityLabel="Forward 10 seconds" onPress={() => clock.skip(10)} />
      </HStack>

      <Box className="absolute bottom-0 left-4 right-4">
        <Scrubber
          positionSec={clock.positionSec}
          durationSec={episode.durationSec}
          onSeek={(sec) => {
            clock.seek(sec);
            setFollowing(true);
          }}
        />
      </Box>
    </Box>
  );

  return (
    <Box style={{ paddingTop: insets.top }} className="flex-1 bg-background">
      {panel}

      {expanded ? null : (
        <Box className="flex-1">
          <ScrollView
            ref={scrollRef}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
            onScrollBeginDrag={() => setFollowing(false)}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          >
            <VStack className="gap-1.5 px-5 pt-[18px]">
              <Text className="font-inter-semibold text-[13px] text-brand">{episodeLabel(episode, book)}</Text>
              <Text accessibilityRole="header" className="font-display text-[24px] leading-[28px] text-foreground">
                {episode.title}
              </Text>
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
              <SegmentedProgress watched={watchedFlags} currentIndex={index} className="mt-1" />
            </VStack>

            <HStack className="gap-2 px-5 pt-4">
              <ControlButton
                accessibilityLabel="Previous episode"
                disabled={!prev}
                onPress={() => prev && goToEpisode(prev)}
              >
                <Icon name="previous" size={18} className="text-foreground" />
              </ControlButton>
              <ControlButton accessibilityLabel={`Playback speed ${clock.speed}×`} onPress={clock.cycleSpeed}>
                <Text className="font-inter-semibold text-[14px] text-foreground tabular-nums">{clock.speed}×</Text>
              </ControlButton>
              <ControlButton
                accessibilityLabel={saved ? 'Saved' : 'Save episode'}
                selected={saved}
                onPress={() => setSaved((s) => !s)}
              >
                <Icon name={saved ? 'bookmarkFilled' : 'bookmark'} size={16} className={saved ? 'text-brand' : 'text-foreground'} />
                <Text className="font-inter-medium text-[14px] text-foreground">{saved ? 'Saved' : 'Save'}</Text>
              </ControlButton>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next episode"
                accessibilityState={{ disabled: !next }}
                disabled={!next}
                onPress={() => next && goToEpisode(next)}
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

            {tab === 'transcript' ? (
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
                  <HStack key={text} className="gap-3.5 rounded-[14px] border border-border bg-card p-4">
                    <Box className="h-7 w-7 items-center justify-center rounded-full bg-brand">
                      <Text className="font-inter-semibold text-[13px] text-brand-foreground">{i + 1}</Text>
                    </Box>
                    <Text className="flex-1 font-inter text-[15px] leading-[23px] text-foreground">{text}</Text>
                  </HStack>
                ))}
              </VStack>
            )}

            {next ? (
              <VStack className="gap-3 px-5 pt-[26px]">
                <Text accessibilityRole="header" className="font-display text-[18px] text-foreground">
                  Up next
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Up next: ${episodeLabel(next, book)}, ${next.title}`}
                  onPress={() => goToEpisode(next)}
                  className="flex-row items-center gap-3.5 rounded-[14px] border border-border bg-card p-3 active:opacity-80"
                >
                  <EpisodeThumb episode={next} size="sm" />
                  <VStack className="min-w-0 flex-1 gap-[3px]">
                    <Text className="font-inter-semibold text-[12px] text-muted-foreground">{episodeLabel(next, book)}</Text>
                    <Text numberOfLines={2} className="font-inter-semibold text-[15px] leading-[19px] text-foreground">
                      {next.title}
                    </Text>
                  </VStack>
                </Pressable>
              </VStack>
            ) : null}
          </ScrollView>

          {!following && tab === 'transcript' ? (
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
          ) : null}
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
