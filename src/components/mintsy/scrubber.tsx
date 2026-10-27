import { useState } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/series';

type ScrubberProps = {
  positionSec: number;
  durationSec: number;
  onSeek: (sec: number) => void;
};

/** Draggable seek bar with current time / duration. Tap or drag anywhere on the track. */
export function Scrubber({ positionSec, durationSec, onSeek }: ScrubberProps) {
  const [width, setWidth] = useState(0);
  const [dragSec, setDragSec] = useState<number | null>(null);

  const toSec = (x: number) => (width > 0 ? Math.min(1, Math.max(0, x / width)) * durationSec : 0);

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => setDragSec(toSec(e.x)),
    onUpdate: (e) => setDragSec(toSec(e.x)),
    onFinalize: (e) => {
      if (!e.canceled) onSeek(toSec(e.x));
      setDragSec(null);
    },
  });

  const shown = dragSec ?? positionSec;
  const pct = durationSec > 0 ? (shown / durationSec) * 100 : 0;

  return (
    <Box className="gap-1.5">
      <GestureDetector gesture={pan}>
        {/* 28pt tall hit area around the 4pt track */}
        <Box
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Seek"
          accessibilityValue={{ text: `${formatTime(shown)} of ${formatTime(durationSec)}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => onSeek(positionSec + (e.nativeEvent.actionName === 'increment' ? 10 : -10))}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          className="h-7 justify-center"
        >
          <Box className="h-1 rounded-sm bg-on-scrim/25">
            <Box style={{ width: `${pct}%` }} className="h-1 rounded-sm bg-brand" />
          </Box>
          <Box
            style={{ left: `${pct}%` }}
            className={`absolute -ml-[7px] h-3.5 w-3.5 rounded-full bg-on-scrim ${dragSec !== null ? 'scale-125' : ''}`}
          />
        </Box>
      </GestureDetector>
      <HStack className="justify-between">
        <Text className="font-inter-medium text-[12px] text-on-scrim tabular-nums">{formatTime(shown)}</Text>
        <Text className="font-inter-medium text-[12px] text-on-scrim tabular-nums">{formatTime(durationSec)}</Text>
      </HStack>
    </Box>
  );
}
