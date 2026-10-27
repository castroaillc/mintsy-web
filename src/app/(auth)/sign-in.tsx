import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { FormAlert } from '@/components/auth/form-alert';
import { TextField } from '@/components/auth/text-field';
import { BrandButton } from '@/components/mintsy/brand-button';
import { Text } from '@/components/ui/text';
import { authClient } from '@/lib/auth-client';

const WRONG_CREDENTIALS = 'That email and password don’t match. Try again or reset your password.';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email || !password || loading) return;
    setError(undefined);
    setLoading(true);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    setLoading(false);
    // On success the session updates and the root layout's guard navigates away
    if (error) {
      setError(
        error.code === 'INVALID_EMAIL_OR_PASSWORD' ? WRONG_CREDENTIALS : (error.message ?? 'Unable to sign in'),
      );
    }
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={<AuthFooterLink prompt="New to mintsy?" action="Create account" href="/sign-up" />}
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={onSubmit}
        returnKeyType="go"
        labelAccessory={
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/forgot-password')}
            hitSlop={{ top: 12, bottom: 12, left: 8 }}
          >
            <Text className="font-inter-medium text-[14px] text-brand">Forgot password?</Text>
          </Pressable>
        }
      />
      {error ? <FormAlert message={error} /> : null}
      <BrandButton
        label="Sign in"
        height={54}
        loading={loading}
        disabled={!email || !password}
        onPress={onSubmit}
        className="mt-2"
      />
    </AuthScreen>
  );
}
