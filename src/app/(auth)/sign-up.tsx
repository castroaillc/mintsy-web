import { useState } from 'react';

import { AuthFooterLink } from '@/components/auth/auth-footer-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { FormAlert } from '@/components/auth/form-alert';
import { SocialSignIn } from '@/components/auth/social-sign-in';
import { TextField } from '@/components/auth/text-field';
import { BrandButton } from '@/components/mintsy/brand-button';
import { MIN_PASSWORD_LENGTH, newPasswordError } from '@/lib/account';
import { authClient } from '@/lib/auth-client';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [socialError, setSocialError] = useState<string>();

  async function onSubmit() {
    setError(undefined);
    setSocialError(undefined);
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
      <SocialSignIn divider="below" onError={setSocialError} />
      {socialError ? <FormAlert message={socialError} /> : null}
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
        autoCorrect={false}
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
        error={newPasswordError(password)}
      />
      {error ? <FormAlert message={error} /> : null}
      <BrandButton
        label="Create account"
        testID="signup-submit"
        height={54}
        loading={loading}
        disabled={!name.trim() || !email.trim() || password.length < MIN_PASSWORD_LENGTH}
        onPress={onSubmit}
        className="mt-2"
      />
    </AuthScreen>
  );
}
