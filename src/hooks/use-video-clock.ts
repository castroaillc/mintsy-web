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

/**
 * Real playback of an MP4, HLS playlist or local file with the same interface as `usePlaybackClock`, plus the player
 * for `VideoView`. If `source` fails and there's a `fallback`, switches to it once, at the same position and speed.
 */
export function useVideoClock(
  source: string,
  { durationSec, startSec = 0, autoPlay = true, initialSpeed = 1, onEnd }: PlaybackClockOptions,
  fallback?: string | null,
) {
  const [speedIndex, setSpeedIndex] = useState(() => Math.max(0, SPEEDS.indexOf(initialSpeed)));
  const speed = SPEEDS[speedIndex];
  const [positionSec, setPositionSec] = useState(startSec);
  const [ended, setEnded] = useState(false);

  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = TIME_UPDATE_INTERVAL;
    p.playbackRate = SPEEDS[speedIndex];
  });

  // Latest callback without re-subscribing
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  // Seeking before the source has loaded isn't reliable, so resume once it's ready
  const started = useRef(false);
  /** Where the next source to become ready starts: the resume point, then the viewer's latest position. */
  const resumeSec = useRef(startSec);
  /** Whether a source that becomes ready should play: the viewer's choice, not `player.playing`, which a failure clears. */
  const wantsPlay = useRef(autoPlay);
  const start = () => {
    if (started.current) return;
    started.current = true;
    if (resumeSec.current > 0) seekPlayer(player, resumeSec.current);
    if (wantsPlay.current) player.play();
  };

  // Once only: if the fallback fails too, the player is left as it is for any source that fails
  const fellBack = useRef(false);
  const fallBack = () => {
    if (fellBack.current || !fallback) return;
    fellBack.current = true;
    started.current = false;
    player.replaceAsync(fallback).catch((err) => console.warn('Failed to load the fallback video', err));
  };
  const onStatus = (status: VideoPlayerStatus) => {
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
    if (status !== 'loading' || !fallback) return;
    const timer = setTimeout(fallBack, STALL_FALLBACK_MS);
    return () => clearTimeout(timer);
    // fallBack only reads refs besides these
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, player, fallback]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    // While the fallback loads the player reports 0; keep showing (and saving) where the viewer was
    if (fellBack.current && !started.current) return;
    if (started.current) resumeSec.current = currentTime;
    setPositionSec(currentTime);
  });
  useEventListener(player, 'playToEnd', () => {
    wantsPlay.current = false;
    setPositionSec(durationSec);
    setEnded(true);
    onEndRef.current?.();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const seek = (sec: number) => {
    const target = Math.min(durationSec, Math.max(0, sec));
    seekPlayer(player, target);
    resumeSec.current = target;
    // Move the UI right away instead of waiting for the next time update
    setPositionSec(target);
    setEnded(false);
  };

  return {
    player,
    positionSec,
    playing: isPlaying,
    speed,
    seek,
    skip: (deltaSec: number) => seek(positionSec + deltaSec),
    toggle: () => {
      // Replaying from the end starts over
      if (ended) {
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
      setPlayerRate(player, SPEEDS[next]);
    },
  };
}
