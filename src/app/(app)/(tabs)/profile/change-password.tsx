import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { FormAlert } from '@/components/auth/form-alert';
import { TextField } from '@/components/auth/text-field';
import { BrandButton } from '@/components/mintsy/brand-button';
import { AccountFormScreen } from '@/components/settings/account-form-screen';
import {
  authErrorMessage,
  confirmPasswordError,
  MIN_PASSWORD_LENGTH,
  newPasswordError,
} from '@/lib/account';
import { authClient } from '@/lib/auth-client';
import { RESET_PASSWORD_URL } from '@/lib/deep-links';
import { setFlash } from '@/lib/flash';

/** Settings › Change password (not designed; follows the Settings look). Signs out other devices. */
export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentError, setCurrentError] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const { data: session } = authClient.useSession();
  const email = session?.user.email;

  /** Forgot the current password: email a reset link to the account's address. */
  async function sendResetLink() {
    if (!email) return;
    setSendingReset(true);
    try {
      const { error } = await authClient.requestPasswordReset({ email, redirectTo: RESET_PASSWORD_URL });
      if (error && !error.status) throw error;
      Alert.alert('Check your email', `We’ve sent a link to ${email} to choose a new password.`);
    } catch {
      Alert.alert('Couldn’t send the email', 'Check your connection and try again.');
    } finally {
      setSendingReset(false);
    }
  }

  const canSubmit = current.length > 0 && password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  async function onSubmit() {
    if (!canSubmit || loading) return;
    setError(undefined);
    setCurrentError(undefined);
    if (password === current) {
      setError('Choose a password that’s different from your current one.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: password,
        revokeOtherSessions: true,
      });
      if (error) {
        if (error.code === 'INVALID_PASSWORD') setCurrentError('That’s not your current password.');
        else setError(authErrorMessage(error, 'We couldn’t change your password. Try again.'));
        return;
      }
      setFlash('settings', 'Password changed. Other devices have been signed out.');
      router.back();
    } catch {
      setError('Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccountFormScreen
      title="Change password"
      intro="Changing your password signs you out on your other devices."
    >
      <TextField
        label="Current password"
        value={current}
        onChangeText={(v) => {
          setCurrent(v);
          setCurrentError(undefined);
        }}
        placeholder="Your current password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={currentError}
        returnKeyType="next"
        autoFocus
      />
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
      <BrandButton label="Change password" testID="change-password-submit" height={54} loading={loading} disabled={!canSubmit} onPress={onSubmit} className="mt-2" />
      {email ? (
        <BrandButton
          label="Forgot it? Email me a reset link"
          variant="outline"
          height={48}
          loading={sendingReset}
          onPress={sendResetLink}
        />
      ) : null}
    </AccountFormScreen>
  );
}
