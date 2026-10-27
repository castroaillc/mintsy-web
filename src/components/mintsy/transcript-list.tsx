import { Pressable } from 'react-native';

import { Icon } from '@/components/mintsy/icon';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { TranscriptLine } from '@/data/mock';
import { formatTime } from '@/lib/series';

/** Fixed so line offsets reported to the parent can include it. */
const HEADER_HEIGHT = 36;

type TranscriptListProps = {
  lines: TranscriptLine[];
  activeIndex: number;
  /** True while the parent is auto-scrolling to the active line. */
  following: boolean;
  onSeek: (sec: number) => void;
  /** Reports each line's y (relative to this list) so the parent can scroll to it. */
  onLineLayout?: (index: number, y: number, height: number) => void;
};

/** Transcript synced to playback: active line raised, past lines muted, tap to seek. */
export function TranscriptList({ lines, activeIndex, following, onSeek, onLineLayout }: TranscriptListProps) {
  return (
    <VStack>
      <HStack style={{ height: HEADER_HEIGHT }} className="items-end justify-between px-5 pb-1.5">
        <Text className="font-inter text-[13px] text-muted-foreground">Tap a line to jump there</Text>
        {following ? (
          <HStack className="items-center gap-1.5">
            <Icon name="arrowDown" size={14} className="text-brand" />
            <Text className="font-inter-semibold text-[13px] text-brand">Following along</Text>
          </HStack>
        ) : null}
      </HStack>
      <VStack className="gap-0.5 px-3">
        {lines.map((line, i) => {
          const current = i === activeIndex;
          const past = i < activeIndex;
          return (
            <Pressable
              key={line.startSec}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
              accessibilityHint="Jumps playback to this line"
              onPress={() => onSeek(line.startSec)}
              onLayout={(e) => onLineLayout?.(i, HEADER_HEIGHT + e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
              className={`flex-row gap-3 rounded-xl px-2.5 py-3 ${current ? 'bg-tag' : 'active:bg-tag/60'}`}
            >
              <Text
                className={`w-10 font-inter-semibold text-[13px] leading-[24px] tabular-nums ${
                  current ? 'text-brand' : 'text-faint'
                }`}
              >
                {formatTime(line.startSec)}
              </Text>
              <Text
                className={`flex-1 text-[16px] leading-[24px] ${
                  current
                    ? 'font-inter-semibold text-foreground'
                    : past
                      ? 'font-inter text-faint'
                      : 'font-inter text-secondary-foreground'
                }`}
              >
                {line.text}
              </Text>
            </Pressable>
          );
        })}
      </VStack>
    </VStack>
  );
}
