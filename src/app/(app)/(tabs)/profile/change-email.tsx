import { router } from 'expo-router';
import { useState } from 'react';

import { FormAlert } from '@/components/auth/form-alert';
import { TextField } from '@/components/auth/text-field';
import { BrandButton } from '@/components/mintsy/brand-button';
import { Icon } from '@/components/mintsy/icon';
import { AccountFormScreen } from '@/components/settings/account-form-screen';
import { Center } from '@/components/ui/center';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { authErrorMessage, isValidEmail } from '@/lib/account';
import { authClient } from '@/lib/auth-client';
import { EMAIL_CHANGED_URL } from '@/lib/deep-links';
import { setFlash } from '@/lib/flash';

/**
 * Settings › Email and Edit profile › Email (not designed; follows the Settings look).
 * Better Auth emails a confirmation link to the new address (the old one gets a notice); opening it
 * comes back as `<scheme>://email-changed` (see app/email-changed.tsx). A taken address also "succeeds", with no email.
 */
export default function ChangeEmailScreen() {
  const { data: session, refetch } = authClient.useSession();
  const currentEmail = session?.user.email ?? '';
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const trimmed = email.trim();
  const same = trimmed.toLowerCase() === currentEmail.toLowerCase();
  const canSubmit = isValidEmail(trimmed) && !same;

  async function onSubmit() {
    if (!canSubmit || loading) return;
    setError(undefined);
    setLoading(true);
    try {
      const { error } = await authClient.changeEmail({ newEmail: trimmed, callbackURL: EMAIL_CHANGED_URL });
      if (error) {
        setError(authErrorMessage(error, 'We couldn’t start the change. Try again.'));
        return;
      }
      // Accounts the server lets change without confirmation switch straight away
      await refetch({ query: { disableCookieCache: true } }).catch(() => {});
      const fresh = await authClient.getSession().catch(() => null);
      if (fresh?.data?.user.email.toLowerCase() === trimmed.toLowerCase()) {
        setFlash('settings', `Email updated to ${trimmed}.`);
        router.back();
        return;
      }
      setSentTo(trimmed);
    } catch {
      setError('Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <AccountFormScreen title="Confirm from your inbox">
        <Center className="h-16 w-16 rounded-full bg-tag">
          <Icon name="mail" size={26} className="text-brand" />
        </Center>
        <VStack className="gap-2">
          <Text className="font-inter-semibold text-[17px] text-foreground">Check your new inbox</Text>
          <Text className="font-inter text-[15px] leading-[22px] text-muted-foreground">
            If {sentTo} can be used, we’ve sent it a confirmation link. Open it on this device to finish the change.
          </Text>
          <Text className="font-inter text-[15px] leading-[22px] text-muted-foreground">
            Until then, keep signing in with {currentEmail}.
          </Text>
        </VStack>
        <BrandButton label="Done" height={54} onPress={() => router.back()} className="mt-2" />
        <BrandButton label="Use a different email" variant="outline" height={48} onPress={() => setSentTo(undefined)} />
      </AccountFormScreen>
    );
  }

  return (
    <AccountFormScreen
      title="Change email"
      intro="We’ll send a link to confirm the new address. Your email doesn’t change until you open it."
    >
      <TextField label="Current email" value={currentEmail} isReadOnly />
      <TextField
        label="New email"
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
        error={trimmed && same ? 'That’s already your email.' : undefined}
        autoFocus
      />
      {error ? <FormAlert message={error} /> : null}
      <BrandButton label="Send confirmation link" height={54} loading={loading} disabled={!canSubmit} onPress={onSubmit} className="mt-2" />
    </AccountFormScreen>
  );
}
