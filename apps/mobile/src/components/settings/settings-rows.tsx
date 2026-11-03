import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '@/components/mintsy/icon';
import { Switch } from '@/components/mintsy/switch';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

type LinkRowProps = {
  label: string;
  value?: string;
  onPress: () => void;
  /** `link` for navigation, `button` for in-place actions. */
  role?: 'link' | 'button';
};

/** 56pt row with an optional value and a chevron. */
export function SettingsLinkRow({ label, value, onPress, role = 'button' }: LinkRowProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      className="min-h-14 flex-row items-center justify-between gap-3 px-4 active:bg-surface-raised"
    >
      <Text className="font-inter text-[15px] text-foreground">{label}</Text>
      <HStack className="shrink items-center gap-2">
        {value ? (
          <Text numberOfLines={1} className="shrink font-inter text-[14px] text-muted-foreground">
            {value}
          </Text>
        ) : null}
        <Icon name="chevronRight" size={14} className="text-muted-foreground" />
      </HStack>
    </Pressable>
  );
}

type ToggleRowProps = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

/** 64pt row with a label, hint and switch. The whole row toggles. */
export function SettingsToggleRow({ label, hint, value, onChange, disabled }: ToggleRowProps) {
  return (
    <HStack className="min-h-16 items-center justify-between gap-3 px-4 py-2">
      <VStack className="flex-1 gap-[3px]">
        <Text className="font-inter text-[15px] text-foreground">{label}</Text>
        {hint ? <Text className="font-inter text-[13px] text-faint">{hint}</Text> : null}
      </VStack>
      <Switch value={value} onChange={onChange} accessibilityLabel={label} accessibilityHint={hint} disabled={disabled} />
    </HStack>
  );
}

/** Free-form row content with the standard padding. */
export function SettingsContentRow({ children }: { children: ReactNode }) {
  return <Box className="px-4 py-3">{children}</Box>;
}

/** 56pt read-only row: a label and value with an optional note under it (e.g. "You sign in with Apple"). */
export function SettingsInfoRow({ label, value, hint }: { label: string; value?: string; hint?: string }) {
  return (
    <HStack accessible className="min-h-14 items-center justify-between gap-3 px-4 py-2">
      <VStack className="shrink-0 gap-[3px]">
        <Text className="font-inter text-[15px] text-foreground">{label}</Text>
        {hint ? <Text className="font-inter text-[13px] text-faint">{hint}</Text> : null}
      </VStack>
      {value ? (
        <Text numberOfLines={1} className="shrink font-inter text-[14px] text-muted-foreground">
          {value}
        </Text>
      ) : null}
    </HStack>
  );
}
