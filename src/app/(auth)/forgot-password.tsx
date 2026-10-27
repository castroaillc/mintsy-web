import { router } from 'expo-router';

import { AuthScreen } from '@/components/auth/auth-screen';
import { BrandButton } from '@/components/mintsy/brand-button';
import { Text } from '@/components/ui/text';

/** Placeholder until password reset is wired to the API. */
export default function ForgotPasswordScreen() {
  return (
    <AuthScreen title="Reset password" subtitle="Password reset isn’t available in the app yet.">
      <Text className="font-inter text-[15px] leading-[23px] text-muted-foreground">
        We’re working on it. In the meantime, contact support and we’ll help you get back in.
      </Text>
      <BrandButton label="Back to sign in" height={54} onPress={() => router.back()} className="mt-2" />
    </AuthScreen>
  );
}
