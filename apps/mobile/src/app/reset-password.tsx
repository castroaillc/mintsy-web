import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AuthScreen } from '@/components/auth/auth-screen';
import { FormAlert } from '@/components/auth/form-alert';
import { TextField } from '@/components/auth/text-field';
import { BrandButton } from '@/components/mintsy/brand-button';
import { Text } from '@/components/ui/text';
import {
  authErrorMessage,
  confirmPasswordError,
  MIN_PASSWORD_LENGTH,
  newPasswordError,
} from '@/lib/account';
import { authClient } from '@/lib/auth-client';
import { setFlash } from '@/lib/flash';

/**
 * Opened by the password reset email: `<scheme>://reset-password?token=…` (or `?error=INVALID_TOKEN`
 * when Better Auth already knows the link is bad). Outside the auth guards so it opens signed in or out.
 */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const { data: session } = authClient.useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  // The token the server turned down, so a newer link opened over this screen gets a fresh try
  const [rejectedToken, setRejectedToken] = useState<string>();
  const [loading, setLoading] = useState(false);

  const expired = !params.token || !!params.error || rejectedToken === params.token;
  const canSubmit = password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  async function onSubmit() {
    if (!canSubmit || loading || !params.token) return;
    setError(undefined);
    setLoading(true);
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token: params.token });
      if (error) {
        if (error.code === 'INVALID_TOKEN') setRejectedToken(params.token);
        else setError(authErrorMessage(error, 'We couldn’t reset your password. Try again.'));
        return;
      }
      // Resetting signs out every session, this device's too, so sign in again with the new password
      const note = 'Password updated. Sign in with your new password.';
      if (session) {
        // Signed in here too: clear the dead session; the guard returns to Welcome, which shows the note
        setFlash('welcome', note);
        await authClient.signOut().catch(() => {});
        router.replace('/welcome');
      } else {
        setFlash('sign-in', note);
        router.replace('/sign-in');
      }
    } catch {
      setError('Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (expired) {
    return (
      <AuthScreen title="Link expired" subtitle="This reset link is invalid, expired or was already used.">
        <Text className="font-inter text-[15px] leading-[23px] text-muted-foreground">
          Reset links work once, for an hour. Request a new one and open it from your latest email.
        </Text>
        <BrandButton
          label="Send a new link"
          height={54}
          onPress={() => router.replace(session ? '/profile/settings' : '/forgot-password')}
          className="mt-2"
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Choose a new password" subtitle="You’ll be signed out everywhere, then sign in with the new one.">
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        helper={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
        error={newPasswordError(password)}
        returnKeyType="next"
        autoFocus
      />
      <TextField
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Type it again"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={confirmPasswordError(password, confirm)}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      {error ? <FormAlert message={error} /> : null}
      <BrandButton label="Update password" testID="reset-password-submit" height={54} loading={loading} disabled={!canSubmit} onPress={onSubmit} className="mt-2" />
    </AuthScreen>
  );
}
