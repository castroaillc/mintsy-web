import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';

import { SPEEDS, type PlaybackClockOptions } from '@/hooks/use-playback-clock';

/** How often the player reports its position, in seconds. */
const TIME_UPDATE_INTERVAL = 0.25;

// expo-video is driven by assigning player properties, which the React Compiler lint reads as
// mutating a hook's return value; these helpers keep that out of the hook body.
function seekPlayer(player: VideoPlayer, sec: number) {
  player.currentTime = sec;
}

function setPlayerRate(player: VideoPlayer, rate: number) {
  player.playbackRate = rate;
}

/** Real playback of an MP4 with the same interface as `usePlaybackClock`, plus the player for `VideoView`. */
export function useVideoClock(
  source: string,
  { durationSec, startSec = 0, autoPlay = true, initialSpeed = 1, onEnd }: PlaybackClockOptions,
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
  const start = () => {
    if (started.current) return;
    started.current = true;
    if (startSec > 0) seekPlayer(player, startSec);
    if (autoPlay) player.play();
  };
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') start();
  });
  // The source may already be loaded before the listener attaches
  useEffect(() => {
    if (player.status === 'readyToPlay') start();
    // Runs once per player; start() guards itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => setPositionSec(currentTime));
  useEventListener(player, 'playToEnd', () => {
    setPositionSec(durationSec);
    setEnded(true);
    onEndRef.current?.();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const seek = (sec: number) => {
    const target = Math.min(durationSec, Math.max(0, sec));
    seekPlayer(player, target);
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
        seek(0);
        player.play();
      } else if (isPlaying) {
        player.pause();
      } else {
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
