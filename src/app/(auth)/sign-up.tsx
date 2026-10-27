import { useState } from 'react';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { FormAlert } from '@/components/auth/form-alert';
import { TextField } from '@/components/auth/text-field';
import { BrandButton } from '@/components/mintsy/brand-button';
import { authClient } from '@/lib/auth-client';

// Better Auth's default minimum password length
const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  async function onSubmit() {
    setError(undefined);
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    setLoading(false);
    // On success Better Auth signs the user in and the root layout's guard moves on to onboarding
    if (error) setError(error.message ?? 'Unable to create account');
  }

  return (
    <AuthScreen
      title="Create account"
      subtitle="It only takes a minute."
      footer={<AuthFooterLink prompt="Already have an account?" action="Sign in" href="/sign-in" />}
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Jane Doe"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
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
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        helper={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
        error={passwordTooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
      />
      {error ? <FormAlert message={error} /> : null}
      <BrandButton
        label="Create account"
        height={54}
        loading={loading}
        disabled={!name.trim() || !email.trim() || password.length < MIN_PASSWORD_LENGTH}
        onPress={onSubmit}
        className="mt-2"
      />
    </AuthScreen>
  );
}
