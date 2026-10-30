import { useState } from 'react';
import { Pressable } from 'react-native';

import { FormAlert } from '@/components/auth/form-alert';
import { TextField } from '@/components/auth/text-field';
import { BrandButton } from '@/components/mintsy/brand-button';
import { Icon } from '@/components/mintsy/icon';
import { Spinner } from '@/components/mintsy/spinner';
import { AccountFormScreen } from '@/components/settings/account-form-screen';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { authErrorMessage } from '@/lib/account';
import { authClient } from '@/lib/auth-client';
import { useDownloads } from '@/lib/downloads';
import { setFlash } from '@/lib/flash';
import { clearOnboardingData } from '@/lib/onboarding';
import { logOutPurchases, useManageSubscription, usePremium } from '@/lib/premium';
import { unregisterPushNotifications } from '@/lib/push';
import { cancelDailyReminder } from '@/lib/reminders';
import { providerLabel, signInWith, useLinkedAccounts } from '@/lib/social-auth';

const DELETED = [
  'Your profile, name and email',
  'Watch progress, streaks and finished series',
  'My List (saved series and episodes)',
  'Your interests, daily goal and reminder settings',
  'Downloads on this device',
];

/**
 * Deleting without a password needs a recent sign-in: the backend answers `403 REAUTH_REQUIRED` when the session is
 * older than 10 minutes. Better Auth's own codes for the same check are accepted too.
 */
const REAUTH_CODES = ['REAUTH_REQUIRED', 'SESSION_EXPIRED', 'SESSION_NOT_FRESH'];

type DeleteError = { code?: string; message?: string; status?: number };

async function deleteAccount(password?: string): Promise<DeleteError | null> {
  // Social-only accounts send no password field at all (a password gives 400 CREDENTIAL_ACCOUNT_NOT_FOUND)
  const { error } = await authClient.deleteUser(password ? { password } : {});
  return error ?? null;
}

/**
 * Settings › Delete account (not designed; follows the Settings look). Deletion is immediate:
 * Better Auth's deleteUser checks the password and the backend removes all of the user's data.
 * Apple / Google-only accounts have no password: they confirm without one, and the server requires a recent
 * sign-in instead.
 */
export default function DeleteAccountScreen() {
  const { data: session } = authClient.useSession();
  const premium = usePremium();
  const manageSubscription = useManageSubscription();
  const downloads = useDownloads();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [needsFreshSignIn, setNeedsFreshSignIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accounts = useLinkedAccounts();
  const needsPassword = accounts.hasPassword;
  const canDelete = !accounts.loading && (!needsPassword || !!password);

  async function onDelete() {
    if (!canDelete || deleting) return;
    const userId = session?.user.id;
    setError(undefined);
    setPasswordError(undefined);
    setNeedsFreshSignIn(false);
    setDeleting(true);
    try {
      let error = await deleteAccount(needsPassword ? password : undefined);
      if (error && !needsPassword && error.code && REAUTH_CODES.includes(error.code)) {
        // Confirm it's them with Apple / Google again, then retry straight away
        const reauth = signInWith(accounts.socialProvider);
        if (!reauth) {
          setNeedsFreshSignIn(true);
          setDeleting(false);
          return;
        }
        const result = await reauth;
        if (result.status !== 'success') {
          if (result.status === 'error') setError(result.message);
          setDeleting(false);
          return;
        }
        // A different Google account would have switched the session: never delete someone else
        const fresh = await authClient.getSession().catch(() => null);
        if (!fresh?.data || fresh.data.user.id !== userId) {
          setError('That’s a different account. Sign in with the account you want to delete.');
          setDeleting(false);
          return;
        }
        error = await deleteAccount();
      }
      if (error) {
        if (error.code === 'INVALID_PASSWORD') setPasswordError('That password isn’t right.');
        else if (!needsPassword && error.code && REAUTH_CODES.includes(error.code)) setNeedsFreshSignIn(true);
        else setError(authErrorMessage(error, 'We couldn’t delete your account. Try again.'));
        setDeleting(false);
        return;
      }
    } catch {
      setError('Check your connection and try again.');
      setDeleting(false);
      return;
    }

    // The account is gone: clear everything it left on this device, then let the guard return to Welcome
    setFlash('welcome', 'Your account has been deleted. Thanks for learning with mintsy.');
    downloads.removeAll();
    await Promise.all([
      logOutPurchases(),
      cancelDailyReminder().catch(() => {}),
      userId ? clearOnboardingData(userId) : Promise.resolve(),
    ]);
    // Clears the stored session cookie; the server session is already gone, so ignore its answer
    await authClient.signOut().catch(() => {});
  }

  /** Same as Settings › Sign out; Welcome then asks them to sign in again and come back. */
  async function signOutToReauthenticate() {
    setSigningOut(true);
    setFlash('welcome', 'Sign in again, then go to Settings › Delete account to finish.');
    await unregisterPushNotifications().catch(() => {});
    await cancelDailyReminder().catch(() => {});
    downloads.removeAll();
    await authClient.signOut().catch(() => {});
  }

  const provider = providerLabel(accounts.socialProvider);

  return (
    <AccountFormScreen title="Delete account" intro="This permanently deletes your mintsy account. It can’t be undone.">
      <VStack className="gap-2.5">
        <Text className="ml-1 font-inter-semibold text-[13px] uppercase tracking-[1px] text-muted-foreground">
          What’s deleted
        </Text>
        <VStack className="gap-3 rounded-2xl border border-border bg-card px-4 py-4">
          {DELETED.map((item) => (
            <HStack key={item} className="items-start gap-3">
              <Box className="mt-px h-5 w-5 items-center justify-center rounded-full bg-destructive/10">
                <Icon name="close" size={10} className="text-destructive" />
              </Box>
              <Text className="flex-1 font-inter text-[15px] leading-[21px] text-foreground">{item}</Text>
            </HStack>
          ))}
        </VStack>
      </VStack>

      {premium.isPremium ? (
        <VStack className="gap-3 rounded-2xl border border-border bg-card p-4">
          <HStack className="items-start gap-2.5">
            <Icon name="alert" size={18} className="mt-px text-brand" />
            <Text className="flex-1 font-inter-semibold text-[15px] leading-[21px] text-foreground">
              Deleting your account doesn’t cancel your Premium subscription
            </Text>
          </HStack>
          <Text className="font-inter text-[14px] leading-[21px] text-muted-foreground">
            Your subscription is billed by the {premium.store === 'PLAY_STORE' ? 'Google Play Store' : 'App Store'}. To stop
            future charges, cancel it there first.
          </Text>
          <BrandButton label="Manage subscription" variant="outline" height={48} onPress={manageSubscription} />
        </VStack>
      ) : null}

      {needsPassword ? (
        <TextField
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setPasswordError(undefined);
          }}
          placeholder="Enter your password to confirm"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          error={passwordError}
          returnKeyType="go"
          onSubmitEditing={onDelete}
        />
      ) : (
        <Text className="font-inter text-[14px] leading-[21px] text-muted-foreground">
          You sign in with {provider}, so there’s no password to enter. We may ask you to confirm with {provider}.
        </Text>
      )}
      {error ? <FormAlert message={error} /> : null}
      {needsFreshSignIn ? (
        <VStack className="gap-3">
          <FormAlert
            message={`For your security, sign in with ${provider} again before deleting your account. You’ll need to sign out first.`}
          />
          <BrandButton
            label="Sign out to sign in again"
            variant="outline"
            height={48}
            loading={signingOut}
            onPress={signOutToReauthenticate}
          />
        </VStack>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: deleting, disabled: deleting || !canDelete }}
        disabled={deleting || !canDelete}
        onPress={onDelete}
        className={`mt-2 h-[54px] flex-row items-center justify-center gap-2 rounded-[14px] bg-destructive active:opacity-80 ${
          canDelete ? '' : 'opacity-40'
        }`}
      >
        {deleting ? <Spinner className="text-white" /> : null}
        <Text className="font-inter-semibold text-[16px] text-white">Delete my account</Text>
      </Pressable>
    </AccountFormScreen>
  );
}
