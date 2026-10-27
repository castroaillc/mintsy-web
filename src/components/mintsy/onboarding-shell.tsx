import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { IconButton } from '@/components/mintsy/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

export const ONBOARDING_STEPS = 4;

type OnboardingShellProps = {
  step: number;
  title: string;
  subtitle: string;
  /** Where Back goes when there's no history (e.g. after resuming mid-flow). Omit on step 1. */
  backHref?: Href;
  /** Omit on the last step. */
  onSkip?: () => void;
  /** Shown above the step label (e.g. the reminder preview). */
  hero?: ReactNode;
  children: ReactNode;
  /** Pinned bottom actions. */
  footer: ReactNode;
  /** Draws a divider above the footer. */
  footerDivider?: boolean;
};

/** Header (back · step bar · skip), step label, title, scrolling body and pinned footer. */
export function OnboardingShell({
  step,
  title,
  subtitle,
  backHref,
  onSkip,
  hero,
  children,
  footer,
  footerDivider = true,
}: OnboardingShellProps) {
  const label = `Step ${step} of ${ONBOARDING_STEPS}`;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <HStack className="mt-4 h-11 items-center gap-3 px-6">
        {backHref ? (
          <Box className="-ml-2.5">
            <IconButton
              icon="back"
              variant="ghost"
              iconSize={22}
              accessibilityLabel="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace(backHref))}
            />
          </Box>
        ) : null}
        <HStack accessible accessibilityRole="progressbar" accessibilityLabel={label} className="flex-1 gap-1.5">
          {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
            <Box key={i} className={`h-1 flex-1 rounded-sm ${i < step ? 'bg-brand' : 'bg-input'}`} />
          ))}
        </HStack>
        {onSkip ? (
          <Pressable accessibilityRole="button" onPress={onSkip} className="h-11 min-w-11 items-end justify-center">
            <Text className="font-inter-medium text-[15px] text-muted-foreground">Skip</Text>
          </Pressable>
        ) : (
          <Box className="w-11" />
        )}
      </HStack>

      <ScrollView contentContainerClassName="px-6 pb-6">
        {hero ? <Box className="mt-5">{hero}</Box> : null}
        <VStack className={`gap-2 ${hero ? 'mt-[26px]' : 'mt-6'}`}>
          <Text className="font-inter-semibold text-[13px] text-brand">{label}</Text>
          <Text accessibilityRole="header" className="font-display text-[30px] leading-[33px] tracking-[-0.5px] text-foreground">
            {title}
          </Text>
          <Text className="font-inter text-[16px] leading-[24px] text-muted-foreground">{subtitle}</Text>
        </VStack>
        {children}
      </ScrollView>

      <VStack className={`gap-1.5 bg-background px-6 pb-4 pt-4 ${footerDivider ? 'border-t border-border' : ''}`}>
        {footer}
      </VStack>
    </SafeAreaView>
  );
}

/** Quiet text button under the primary action ("Not now", "Browse all series instead"). */
export function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="h-11 items-center justify-center">
      <Text className="font-inter-medium text-[15px] text-muted-foreground">{label}</Text>
    </Pressable>
  );
}
