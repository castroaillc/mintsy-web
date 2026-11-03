import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { VStack } from '@/components/ui/vstack';

type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  className?: string;
};

/** Placeholder block. Pulses gently, or stays still when Reduce Motion is on. */
export function Skeleton({ width = '100%', height, radius = 8, className = '' }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius }, style]}
      className={`bg-surface-raised ${className}`}
    />
  );
}

/** A labelled loading region made of skeleton rows (e.g. search results). */
export function SkeletonList({ rows = 4, rowHeight = 88, label = 'Loading' }: { rows?: number; rowHeight?: number; label?: string }) {
  return (
    <VStack accessible accessibilityRole="progressbar" accessibilityLabel={label} className="gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={rowHeight} radius={14} />
      ))}
    </VStack>
  );
}
