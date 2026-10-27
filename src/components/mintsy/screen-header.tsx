import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';

import { IconButton } from '@/components/mintsy/icon-button';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

type ScreenHeaderProps = {
  title: string;
  /** Shows a back chevron; falls back to this route when there's no history. */
  backHref?: Href;
  backLabel?: string;
  /** Right-side action (e.g. a settings button). */
  action?: ReactNode;
};

/** 44pt header with an optional back chevron and a 26pt Space Grotesk title. */
export function ScreenHeader({ title, backHref, backLabel = 'Back', action }: ScreenHeaderProps) {
  return (
    <HStack className="h-11 items-center justify-between">
      <HStack className="items-center gap-1.5">
        {backHref ? (
          <Box className="-ml-2.5">
            <IconButton
              icon="back"
              variant="ghost"
              iconSize={22}
              accessibilityLabel={backLabel}
              onPress={() => (router.canGoBack() ? router.back() : router.replace(backHref))}
            />
          </Box>
        ) : null}
        <Text accessibilityRole="header" className="font-display text-[26px] tracking-[-0.4px] text-foreground">
          {title}
        </Text>
      </HStack>
      {action}
    </HStack>
  );
}
