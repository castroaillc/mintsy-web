import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { ScreenHeader } from '@/components/mintsy/screen-header';
import { SafeAreaView } from '@/components/safe-area-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { READABLE_MAX_WIDTH } from '@/hooks/use-wide-layout';

type AccountFormScreenProps = {
  title: string;
  /** Short explanation under the header. */
  intro?: ReactNode;
  children: ReactNode;
  backHref?: Href;
  backLabel?: string;
};

/**
 * Shell for the account screens under Settings (change password, change email, delete account):
 * the Settings header and padding, with the form held to a readable column on wide windows.
 */
export function AccountFormScreen({
  title,
  intro,
  children,
  backHref = '/profile/settings',
  backLabel = 'Back to settings',
}: AccountFormScreenProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-5 pb-10 pt-3"
          contentContainerStyle={{ maxWidth: READABLE_MAX_WIDTH + 40, width: '100%', alignSelf: 'center' }}
        >
          <ScreenHeader title={title} backHref={backHref} backLabel={backLabel} />
          {typeof intro === 'string' ? (
            <Text className="mt-3 font-inter text-[15px] leading-[22px] text-muted-foreground">{intro}</Text>
          ) : (
            intro
          )}
          <VStack className="mt-[26px] gap-[18px]">{children}</VStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
