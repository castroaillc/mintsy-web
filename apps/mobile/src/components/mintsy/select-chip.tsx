import { Pressable } from 'react-native';

import { Icon } from '@/components/mintsy/icon';
import { Text } from '@/components/ui/text';

type SelectChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `lg` = 44pt with a check when selected (onboarding); `md` = 38pt (forms). */
  size?: 'lg' | 'md';
};

/** Multi-select pill: brand border and tint when on. */
export function SelectChip({ label, selected, onPress, size = 'lg' }: SelectChipProps) {
  const lg = size === 'lg';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      hitSlop={lg ? undefined : { top: 3, bottom: 3 }}
      className={`flex-row items-center gap-2 rounded-full border ${lg ? 'h-11 px-4' : 'h-[38px] px-3.5'} ${
        selected ? 'border-brand bg-brand/10' : 'border-input bg-card'
      }`}
    >
      {selected && lg ? <Icon name="check" size={15} className="text-foreground" /> : null}
      <Text
        className={`font-inter-medium ${lg ? 'text-[15px]' : 'text-[14px]'} ${
          selected ? 'text-foreground' : 'text-secondary-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
