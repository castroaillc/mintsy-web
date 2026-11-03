import { router } from 'expo-router';
import { useState } from 'react';

import { AuthScreen } from '@/components/auth/auth-screen';
import { FormAlert } from '@/components/auth/form-alert';
import { TextField } from '@/components/auth/text-field';
import { BrandButton } from '@/components/mintsy/brand-button';
import { Icon } from '@/components/mintsy/icon';
import { Center } from '@/components/ui/center';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { isValidEmail } from '@/lib/account';
import { authClient } from '@/lib/auth-client';
import { RESET_PASSWORD_URL } from '@/lib/deep-links';

/**
 * Asks Better Auth to email a reset link that opens `reset-password` in the app. The same
 * "check your email" message shows whether or not an account exists for the address.
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const valid = isValidEmail(email);

  async function onSubmit() {
    if (!valid || loading) return;
    setError(undefined);
    setLoading(true);
    const address = email.trim();
    try {
      const { error } = await authClient.requestPasswordReset({ email: address, redirectTo: RESET_PASSWORD_URL });
      // Only a failure to reach the server is worth telling apart; anything else still reads as "sent"
      if (error && !error.status) throw error;
      setSentTo(address);
    } catch {
      setError('We couldn’t send the email. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <AuthScreen title="Check your email" subtitle={`If an account exists for ${sentTo}, we’ve sent a link to reset your password.`}>
        <Center className="h-16 w-16 rounded-full bg-tag">
          <Icon name="mail" size={26} className="text-brand" />
        </Center>
        <VStack className="gap-2">
          <Text className="font-inter text-[15px] leading-[23px] text-muted-foreground">
            Open the link on this device within an hour to choose a new password.
          </Text>
          <Text className="font-inter text-[15px] leading-[23px] text-muted-foreground">
            Nothing there? Check your spam folder, or try again.
          </Text>
        </VStack>
        <BrandButton label="Back to sign in" height={54} onPress={() => router.back()} className="mt-2" />
        <BrandButton label="Try a different email" variant="outline" height={48} onPress={() => setSentTo(undefined)} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Reset password" subtitle="Enter your account’s email and we’ll send you a link to choose a new password.">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        autoFocus
      />
      {error ? <FormAlert message={error} /> : null}
      <BrandButton label="Send reset link" height={54} loading={loading} disabled={!valid} onPress={onSubmit} className="mt-2" />
    </AuthScreen>
  );
}
