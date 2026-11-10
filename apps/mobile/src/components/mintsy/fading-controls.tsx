import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { PlayerControls } from '@/hooks/use-player-controls';

/**
 * The controls drawn over a video. Stays mounted while hidden, so a scrubber keeps its measurements, but can't be
 * touched or reached by a screen reader then: a tap falls through to the video. Gaps between controls fall through too.
 */
export function FadingControls({ controls, children }: { controls: PlayerControls; children: ReactNode }) {
  const { progress, visible } = controls;
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, fade]}
    >
      {children}
    </Animated.View>
  );
}
