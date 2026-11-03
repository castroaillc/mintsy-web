import { Children, type ReactNode } from 'react';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

type SettingsSectionProps = {
  title?: string;
  children: ReactNode;
};

/** Uppercase section title over a rounded card; each child is a row with a divider between. */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  const rows = Children.toArray(children);
  return (
    <VStack className="gap-2.5">
      {title ? (
        <Text accessibilityRole="header" className="ml-1 font-inter-semibold text-[13px] uppercase tracking-[1px] text-muted-foreground">
          {title}
        </Text>
      ) : null}
      <Box className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((row, i) => (
          <Box key={i} className={i > 0 ? 'border-t border-border' : ''}>
            {row}
          </Box>
        ))}
      </Box>
    </VStack>
  );
}
