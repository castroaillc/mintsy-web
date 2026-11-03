import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';

type SwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
};

/** 52×32 brand switch. */
export function Switch({ value, onChange, accessibilityLabel, accessibilityHint, disabled }: SwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={6}
      className={`h-8 w-[52px] flex-row rounded-full p-[3px] ${value ? 'justify-end bg-brand' : 'justify-start bg-ring'} ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <Box className="h-[26px] w-[26px] rounded-full bg-on-scrim" />
    </Pressable>
  );
}
