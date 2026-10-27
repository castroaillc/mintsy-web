import type { ReactNode } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

type SectionRowProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
};

/** Section heading with an optional "See all" link over a horizontal rail. */
export function SectionRow({ title, actionLabel, onAction, children }: SectionRowProps) {
  return (
    <VStack className="pt-8">
      <HStack className="items-baseline justify-between px-5 pb-3">
        <Text accessibilityRole="header" className="font-display text-[20px] text-foreground">
          {title}
        </Text>
        {actionLabel ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${actionLabel}: ${title}`}
            onPress={onAction}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          >
            <Text className="font-inter text-[14px] text-muted-foreground">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </HStack>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-5">
        {children}
      </ScrollView>
    </VStack>
  );
}
