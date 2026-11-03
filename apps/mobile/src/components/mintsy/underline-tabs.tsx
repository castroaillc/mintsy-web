import { Pressable } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

type UnderlineTabsProps<T extends string> = {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Keep unselected labels semibold too (player) instead of medium (book). */
  uniformWeight?: boolean;
};

/** Text tabs with a brand underline on the selected one. */
export function UnderlineTabs<T extends string>({ tabs, value, onChange, uniformWeight }: UnderlineTabsProps<T>) {
  return (
    <HStack accessibilityRole="tablist" className="gap-6 border-b border-border px-5">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            className={`h-12 justify-center border-b-[3px] ${selected ? 'border-brand' : 'border-transparent'}`}
          >
            <Text
              className={`text-[15px] ${
                selected
                  ? 'font-inter-semibold text-foreground'
                  : `${uniformWeight ? 'font-inter-semibold' : 'font-inter-medium'} text-muted-foreground`
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </HStack>
  );
}
