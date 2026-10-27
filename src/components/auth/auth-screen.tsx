import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { IconButton } from '@/components/mintsy/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

type AuthScreenProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Pinned to the bottom of the screen (e.g. "Already have an account?"). */
  footer?: ReactNode;
};

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/welcome');
}

/** Shared shell for the sign-in / sign-up forms: back button, title, form, footer. */
export function AuthScreen({ title, subtitle, children, footer }: AuthScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow px-6 pb-8 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          <Box className="-ml-2.5 self-start">
            <IconButton icon="back" variant="ghost" iconSize={22} accessibilityLabel="Back" onPress={goBack} />
          </Box>
          <VStack className="mt-5 gap-2">
            <Text accessibilityRole="header" className="font-display text-[32px] leading-[36px] tracking-[-0.5px] text-foreground">
              {title}
            </Text>
            <Text className="font-inter text-[16px] text-muted-foreground">{subtitle}</Text>
          </VStack>
          <VStack className="mt-8 gap-[18px]">{children}</VStack>
          {footer ? <Box className="mt-auto items-center pt-8">{footer}</Box> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
