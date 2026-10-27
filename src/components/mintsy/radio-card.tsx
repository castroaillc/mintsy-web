import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';

type RadioCardProps = {
  checked: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  /** Draws the radio ring on the right. Off for compact tiles. */
  indicator?: boolean;
  className?: string;
};

/** Single-select card: brand border and tint when checked. */
export function RadioCard({ checked, onPress, accessibilityLabel, children, indicator = true, className = '' }: RadioCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={`flex-row items-center gap-3.5 rounded-2xl border ${
        checked ? 'border-brand bg-brand/5' : 'border-input bg-card'
      } ${className}`}
    >
      {children}
      {indicator ? (
        <Box
          className={`h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${
            checked ? 'border-brand' : 'border-ring'
          }`}
        >
          {checked ? <Box className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
        </Box>
      ) : null}
    </Pressable>
  );
}
