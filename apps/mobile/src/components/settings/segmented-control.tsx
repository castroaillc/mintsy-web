import { Pressable } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

type Option<T extends string | number> = { label: string; value: T };

type SegmentedControlProps<T extends string | number> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** Track styling; defaults to the page background (for use inside a card). */
  className?: string;
};

/** Single-select segments. Selected = filled foreground. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  className = 'bg-background',
}: SegmentedControlProps<T>) {
  return (
    <HStack
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={`gap-1 rounded-xl p-1 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 2, bottom: 2 }}
            className={`h-10 flex-1 items-center justify-center rounded-[9px] ${selected ? 'bg-foreground' : ''}`}
          >
            <Text
              className={`font-inter-semibold text-[14px] ${selected ? 'text-background' : 'text-secondary-foreground'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}
