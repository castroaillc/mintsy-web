import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, type VideoPlayer, type VideoPlayerStatus } from 'expo-video';
import { useEffect, useRef, useState } from 'react';

import { SPEEDS, type PlaybackClockOptions } from '@/hooks/use-playback-clock';

/** How often the player reports its position, in seconds. */
const TIME_UPDATE_INTERVAL = 0.25;

/**
 * How long a source with a fallback may sit in `loading` before giving up on it. On iOS a playlist that loads but
 * whose segments then fail never reports `error`: AVPlayer retries for about 30 s, stops, and stays in `loading`.
 */
const STALL_FALLBACK_MS = 15_000;

// expo-video is driven by assigning player properties, which the React Compiler lint reads as
// mutating a hook's return value; these helpers keep that out of the hook body.
function seekPlayer(player: VideoPlayer, sec: number) {
  player.currentTime = sec;
}

function setPlayerRate(player: VideoPlayer, rate: number) {
  player.playbackRate = rate;
}

/** What a clock's next source is: `fallback` works as for the first one, and `positionSec` is on that source's timeline. */
export type ClockSource = { source: string; fallback?: string | null; positionSec?: number };

/**
 * Real playback of an MP4, HLS playlist or local file with the same interface as `usePlaybackClock`, plus the player
 * for `VideoView`. If a source fails and has a `fallback`, switches to it once, at the same position and speed.
 *
 * The source is only read on first render, so a catalog refresh with new signed URLs can't replace a video in the middle
 * of playback, or put the default narrator back. `load` changes it, and `failed` says a source has nothing left to try.
 * With `deferred` nothing loads or plays until the first `load`.
 */
export function useVideoClock(
  source: string,
  {
    durationSec,
    startSec = 0,
    autoPlay = true,
    initialSpeed = 1,
    onEnd,
    deferred = false,
  }: PlaybackClockOptions & { deferred?: boolean },
  fallback?: string | null,
) {
  const [speedIndex, setSpeedIndex] = useState(() => Math.max(0, SPEEDS.indexOf(initialSpeed)));
  const speed = SPEEDS[speedIndex];
  const speedRef = useRef(speed);
  const [positionSec, setPositionSec] = useState(startSec);
  const [ended, setEnded] = useState(false);
  /** The video's real length: `durationSec` from the API is rounded, and can be up to 0.5 s off. */
  const [mediaDurationSec, setMediaDurationSec] = useState<number | null>(null);
  const timelineEnd = mediaDurationSec ?? durationSec;

  const [firstSource] = useState(deferred ? null : source);
  const player = useVideoPlayer(firstSource, (p) => {
    p.timeUpdateEventInterval = TIME_UPDATE_INTERVAL;
    p.playbackRate = SPEEDS[speedIndex];
  });

  // Latest callback without re-subscribing
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  const readMediaDuration = () => {
    const duration = player.duration;
    if (Number.isFinite(duration) && duration > 0) setMediaDurationSec(duration);
  };

  // Seeking before the source has loaded isn't reliable, so resume once it's ready
  const started = useRef(false);
  /** Where the next source to become ready starts: the resume point, then the viewer's latest position. */
  const resumeSec = useRef(startSec);
  /** Whether a source that becomes ready should play: the viewer's choice, not `player.playing`, which a failure clears. */
  const wantsPlay = useRef(autoPlay);
  const start = () => {
    if (started.current) return;
    started.current = true;
    readMediaDuration();
    setPlayerRate(player, speedRef.current);
    if (resumeSec.current > 0) seekPlayer(player, resumeSec.current);
    if (wantsPlay.current) player.play();
  };

  /** This source's fallback, until it's used. */
  const [fallbackSource, setFallbackSource] = useState(fallback ?? null);
  /** Between asking for a source and the player having it. The ref is for events, the state for `failed`. */
  const swapping = useRef(deferred);
  const [isSwapping, setIsSwapping] = useState(deferred);
  /** A source has replaced the first one, so time updates before it starts are the old item or a 0 to ignore. */
  const replaced = useRef(deferred);
  const loadCount = useRef(0);

  const load = ({ source: next, fallback: nextFallback = null, positionSec: at }: ClockSource) => {
    const count = ++loadCount.current;
    started.current = false;
    replaced.current = true;
    swapping.current = true;
    setIsSwapping(true);
    setFallbackSource(nextFallback);
    setMediaDurationSec(null);
    setEnded(false);
    if (at !== undefined) {
      resumeSec.current = at;
      setPositionSec(at);
    }
    player.pause();
    player
      .replaceAsync(next)
      .catch((err) => console.warn('Failed to load the video', err))
      .finally(() => {
        // A newer load took over
        if (count !== loadCount.current) return;
        swapping.current = false;
        setIsSwapping(false);
        onStatus(player.status);
      });
  };

  const fallBack = () => {
    if (!fallbackSource) return;
    load({ source: fallbackSource });
  };
  const onStatus = (status: VideoPlayerStatus) => {
    if (swapping.current) return;
    if (status === 'readyToPlay') start();
    else if (status === 'error') fallBack();
  };
  useEventListener(player, 'statusChange', ({ status }) => onStatus(status));
  // The source may already be loaded (or have failed) before the listener attaches
  useEffect(() => {
    onStatus(player.status);
    // Runs once per player; start() and fallBack() guard themselves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    if (status !== 'loading' || !fallbackSource) return;
    const timer = setTimeout(fallBack, STALL_FALLBACK_MS);
    return () => clearTimeout(timer);
    // fallBack only reads refs besides these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, player, fallbackSource]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    // While a replacement loads the player reports 0 or the old item; keep showing (and saving) where the viewer was
    if (replaced.current && !started.current) return;
    if (started.current) resumeSec.current = currentTime;
    if (mediaDurationSec === null) readMediaDuration();
    setPositionSec(currentTime);
  });
  useEventListener(player, 'playToEnd', () => {
    wantsPlay.current = false;
    setPositionSec(timelineEnd);
    setEnded(true);
    onEndRef.current?.();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const seek = (sec: number) => {
    const target = Math.min(timelineEnd, Math.max(0, sec));
    // A source still loading starts from resumeSec
    if (!swapping.current) seekPlayer(player, target);
    resumeSec.current = target;
    // Move the UI right away instead of waiting for the next time update
    setPositionSec(target);
    setEnded(false);
  };

  return {
    player,
    positionSec,
    durationSec: timelineEnd,
    ended,
    /** The current source failed and has no fallback left. */
    failed: status === 'error' && player.status === 'error' && !fallbackSource && !isSwapping,
    load,
    /** The latest position, for use after an `await`. */
    currentPosition: () => resumeSec.current,
    playing: isPlaying,
    /** Waiting for data: a source loading, or a stall. `playing` is false during these too. */
    buffering: isSwapping || status === 'loading',
    speed,
    seek,
    skip: (deltaSec: number) => seek(positionSec + deltaSec),
    toggle: () => {
      // No source to act on yet: it follows this when it's ready
      if (swapping.current) {
        wantsPlay.current = !wantsPlay.current;
      } else if (ended) {
        // Replaying from the end starts over
        wantsPlay.current = true;
        seek(0);
        player.play();
      } else if (isPlaying) {
        wantsPlay.current = false;
        player.pause();
      } else {
        wantsPlay.current = true;
        player.play();
      }
    },
    cycleSpeed: () => {
      const next = (speedIndex + 1) % SPEEDS.length;
      setSpeedIndex(next);
      speedRef.current = SPEEDS[next];
      setPlayerRate(player, SPEEDS[next]);
    },
  };
}
