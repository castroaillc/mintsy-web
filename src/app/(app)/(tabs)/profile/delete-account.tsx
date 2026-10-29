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
import { cancelDailyReminder } from '@/lib/reminders';

const DELETED = [
  'Your profile, name and email',
  'Watch progress, streaks and finished series',
  'My List (saved series and episodes)',
  'Your interests, daily goal and reminder settings',
  'Downloads on this device',
];

/**
 * Settings › Delete account (not designed; follows the Settings look). Deletion is immediate:
 * Better Auth's deleteUser checks the password and the backend removes all of the user's data.
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

  async function onDelete() {
    if (!password || deleting) return;
    const userId = session?.user.id;
    setError(undefined);
    setPasswordError(undefined);
    setDeleting(true);
    try {
      const { error } = await authClient.deleteUser({ password });
      if (error) {
        if (error.code === 'INVALID_PASSWORD') setPasswordError('That password isn’t right.');
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
      {error ? <FormAlert message={error} /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: deleting, disabled: deleting || !password }}
        disabled={deleting || !password}
        onPress={onDelete}
        className={`mt-2 h-[54px] flex-row items-center justify-center gap-2 rounded-[14px] bg-destructive active:opacity-80 ${
          password ? '' : 'opacity-40'
        }`}
      >
        {deleting ? <Spinner className="text-white" /> : null}
        <Text className="font-inter-semibold text-[16px] text-white">Delete my account</Text>
      </Pressable>
    </AccountFormScreen>
  );
}
