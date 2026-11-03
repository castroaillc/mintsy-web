import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Smaller horizontal padding, for pills that sit next to other content. */
  compact?: boolean;
};

/** 38pt pill (44pt touch target via hitSlop). Selected = filled foreground. */
export function Chip({ label, selected, onPress, compact }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: 3, bottom: 3 }}
      className={`h-[38px] justify-center rounded-full border ${compact ? 'px-3.5' : 'px-4'} ${
        selected ? 'border-foreground bg-foreground' : 'border-input bg-surface-raised'
      }`}
    >
      <Text
        className={`font-inter-medium text-[14px] ${selected ? 'text-background' : 'text-secondary-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ChipRowProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

/** Horizontally scrolling single-select chips. */
export function ChipRow<T extends string>({ options, value, onChange }: ChipRowProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-5 pb-1"
    >
      {options.map((option) => (
        <Chip key={option} label={option} selected={option === value} onPress={() => onChange(option)} />
      ))}
    </ScrollView>
  );
}
