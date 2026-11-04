import { useEffect, useRef, useState } from 'react';

const TICK_MS = 250;
export const SPEEDS = [1, 1.25, 1.5, 2] as const;

export type PlaybackClockOptions = {
  durationSec: number;
  startSec?: number;
  autoPlay?: boolean;
  initialSpeed?: (typeof SPEEDS)[number];
  onEnd?: () => void;
};

/** Simulated playback position for episodes without real video yet. Respects speed. */
export function usePlaybackClock({
  durationSec,
  startSec = 0,
  autoPlay = true,
  initialSpeed = 1,
  onEnd,
}: PlaybackClockOptions) {
  const [positionSec, setPositionSec] = useState(startSec);
  const [wantsToPlay, setWantsToPlay] = useState(autoPlay);
  const [speedIndex, setSpeedIndex] = useState(() => Math.max(0, SPEEDS.indexOf(initialSpeed)));
  const speed = SPEEDS[speedIndex];

  // Latest callback without restarting the interval
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  const ended = positionSec >= durationSec;
  const playing = wantsToPlay && !ended;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPositionSec((prev) => Math.min(durationSec, prev + (TICK_MS / 1000) * speed));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, durationSec]);

  useEffect(() => {
    if (ended) onEndRef.current?.();
  }, [ended]);

  const seek = (sec: number) => setPositionSec(Math.min(durationSec, Math.max(0, sec)));

  return {
    positionSec,
    durationSec,
    ended,
    playing,
    speed,
    seek,
    skip: (deltaSec: number) => seek(positionSec + deltaSec),
    toggle: () => {
      // Replaying from the end starts over
      if (ended) {
        setPositionSec(0);
        setWantsToPlay(true);
      } else {
        setWantsToPlay((p) => !p);
      }
    },
    cycleSpeed: () => setSpeedIndex((i) => (i + 1) % SPEEDS.length),
  };
}

export type PlaybackClock = ReturnType<typeof usePlaybackClock>;
