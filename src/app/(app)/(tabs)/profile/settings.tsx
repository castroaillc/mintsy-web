import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, type AlertButton } from 'react-native';

import { FormAlert } from '@/components/auth/form-alert';
import { ScreenHeader } from '@/components/mintsy/screen-header';
import { Spinner } from '@/components/mintsy/spinner';
import { SafeAreaView } from '@/components/safe-area-view';
import { SegmentedControl } from '@/components/settings/segmented-control';
import { SettingsContentRow, SettingsLinkRow, SettingsToggleRow } from '@/components/settings/settings-rows';
import { SettingsSection } from '@/components/settings/settings-section';
import type { ModeType } from '@/components/ui/gluestack-ui-provider';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { DAILY_GOALS, REMINDER_TIMES, reminderTime, type ReminderTimeId } from '@/data/interests';
import { SPEEDS } from '@/hooks/use-playback-clock';
import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { authClient } from '@/lib/auth-client';
import { formatBytes, useDownloads } from '@/lib/downloads';
import { clearFlash, useFlash } from '@/lib/flash';
import { openLegalUrl, PRIVACY_URL, SHOW_TERMS, TERMS_LABEL, TERMS_URL } from '@/lib/legal';
import { sendTestNotification } from '@/lib/notifications';
import { planName } from '@/lib/offering';
import { useOnboarding } from '@/lib/onboarding';
import { setPreferences, usePreferences } from '@/lib/preferences';
import { openPaywall, usePremium } from '@/lib/premium';
import { registerForPushNotifications, sendTestPush, unregisterPushNotifications } from '@/lib/push';
import { cancelDailyReminder, scheduleDailyReminder } from '@/lib/reminders';
import { openHelpCenter, sendFeedback } from '@/lib/support';
import { useThemeMode } from '@/lib/theme-mode';

const THEME_OPTIONS: { label: string; value: ModeType }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export default function SettingsScreen() {
  const { data: session } = authClient.useSession();
  const { mode, setMode } = useThemeMode();
  const { permission, request } = useNotificationPermission();
  const { data: onboarding, update } = useOnboarding();
  const prefs = usePreferences();
  const premium = usePremium();
  const [signingOut, setSigningOut] = useState(false);
  const [sendingPush, setSendingPush] = useState(false);
  const downloads = useDownloads();
  // "Password changed", "Email updated" etc. from the account screens
  const notice = useFlash('settings');
  useEffect(() => () => clearFlash('settings'), []);

  const goal = DAILY_GOALS.find((g) => g.minutes === onboarding.dailyGoal)!;
  const time = reminderTime(onboarding.reminderTime);
  const notificationsBlocked = permission === 'denied';
  const remindersOn = onboarding.remindersOn && permission === 'granted';

  function openSystemSettings() {
    Alert.alert('Notifications are off', 'Turn on notifications for mintsy in the system Settings app.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
  }

  async function setReminders(on: boolean) {
    if (!on) {
      update({ remindersOn: false });
      await cancelDailyReminder();
      return;
    }
    const result = permission === 'granted' ? permission : await request();
    if (result !== 'granted') {
      openSystemSettings();
      return;
    }
    registerForPushNotifications().catch((err) => console.warn('Push registration failed:', err));
    update({ remindersOn: true });
    await scheduleDailyReminder(onboarding.reminderTime);
  }

  function pickReminderTime() {
    const choose = (id: ReminderTimeId) => {
      update({ reminderTime: id });
      if (remindersOn) scheduleDailyReminder(id).catch(() => {});
    };
    const buttons: AlertButton[] = REMINDER_TIMES.map((t) => ({
      text: `${t.label} · ${t.time}`,
      onPress: () => choose(t.id),
    }));
    // Android dialogs show at most three buttons
    if (Platform.OS === 'ios') buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Reminder time', undefined, buttons);
  }

  function cycleSpeed() {
    const i = SPEEDS.indexOf(prefs.defaultSpeed);
    setPreferences({ defaultSpeed: SPEEDS[(i + 1) % SPEEDS.length] });
  }

  async function onSendTestPush() {
    setSendingPush(true);
    try {
      // Make sure this device is registered before asking the backend to send
      await registerForPushNotifications();
      const devices = await sendTestPush();
      if (devices === 0) Alert.alert('No devices registered', 'No push token is saved for your account yet.');
    } catch (err) {
      Alert.alert('Push failed', (err as Error).message);
    } finally {
      setSendingPush(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          // Remove this device's push token while the session is still valid
          await unregisterPushNotifications();
          await cancelDailyReminder();
          // Downloads stay with the account, so they leave the device with it
          downloads.removeAll();
          // The root layout's guard returns to the welcome screen once the session clears
          await authClient.signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 pb-10 pt-3">
        <ScreenHeader title="Settings" backHref="/profile" backLabel="Back to profile" />

        {notice ? (
          <Pressable accessibilityHint="Dismisses the message" onPress={() => clearFlash('settings')} className="mt-4">
            <FormAlert tone="success" message={notice} />
          </Pressable>
        ) : null}

        <VStack className="mt-[26px] gap-[26px]">
          <SettingsSection title="Account">
            <SettingsLinkRow
              label="Email"
              value={session?.user.email}
              onPress={() => router.push('/profile/change-email')}
            />
            <SettingsLinkRow
              role="link"
              label="Subscription"
              value={
                premium.loading
                  ? '…'
                  : premium.isPremium
                    ? ['Premium', planName(premium.productId)].filter(Boolean).join(' · ')
                    : 'Free · Upgrade'
              }
              onPress={() => (premium.isPremium ? router.push('/profile/plan') : openPaywall())}
            />
            <SettingsLinkRow role="link" label="Change password" onPress={() => router.push('/profile/change-password')} />
            <SettingsLinkRow
              role="link"
              label="Daily goal"
              value={goal.short}
              onPress={() => router.push('/profile/edit')}
            />
          </SettingsSection>

          <SettingsSection title="Playback">
            <SettingsToggleRow
              label="Autoplay next episode"
              hint="Keep the series going"
              value={prefs.autoplayNext}
              onChange={(v) => setPreferences({ autoplayNext: v })}
            />
            <SettingsLinkRow label="Default speed" value={`${prefs.defaultSpeed}×`} onPress={cycleSpeed} />
            <SettingsToggleRow
              label="Captions on by default"
              hint="Show captions in the player"
              value={prefs.captionsByDefault}
              onChange={(v) => setPreferences({ captionsByDefault: v })}
            />
            <SettingsToggleRow
              label="Download on Wi-Fi only"
              hint="Save mobile data"
              value={prefs.downloadOnWifiOnly}
              onChange={(v) => setPreferences({ downloadOnWifiOnly: v })}
            />
            {downloads.items.length > 0 ? (
              <SettingsLinkRow
                role="link"
                label="Downloads"
                value={`${downloads.items.length} · ${formatBytes(downloads.totalBytes)}`}
                onPress={() => router.navigate('/profile/downloads')}
              />
            ) : null}
          </SettingsSection>

          <SettingsSection title="Appearance">
            <SettingsContentRow>
              <SegmentedControl accessibilityLabel="Theme" options={THEME_OPTIONS} value={mode} onChange={setMode} />
            </SettingsContentRow>
          </SettingsSection>

          <SettingsSection title="Notifications">
            <SettingsToggleRow
              label="Daily reminder"
              hint={
                notificationsBlocked
                  ? 'Notifications are off in system Settings'
                  : remindersOn
                    ? `Every day at ${time.time}`
                    : 'Off'
              }
              value={remindersOn}
              onChange={setReminders}
            />
            <SettingsLinkRow label="Reminder time" value={time.time} onPress={pickReminderTime} />
            <SettingsToggleRow
              label="New series in your interests"
              hint="At most once a week"
              value={prefs.newSeriesAlerts}
              onChange={(v) => setPreferences({ newSeriesAlerts: v })}
            />
            {notificationsBlocked ? (
              <SettingsLinkRow label="Open system Settings" onPress={() => Linking.openSettings()} />
            ) : null}
            {permission === 'granted' ? (
              <SettingsLinkRow label="Send local test notification" onPress={sendTestNotification} />
            ) : null}
            {permission === 'granted' ? (
              <SettingsLinkRow
                label="Send test push from backend"
                value={sendingPush ? 'Sending…' : undefined}
                onPress={sendingPush ? () => {} : onSendTestPush}
              />
            ) : null}
          </SettingsSection>

          <SettingsSection title="Support">
            <SettingsLinkRow role="link" label="Help center" onPress={openHelpCenter} />
            <SettingsLinkRow label="Send feedback" onPress={sendFeedback} />
            {SHOW_TERMS ? (
              <SettingsLinkRow role="link" label={TERMS_LABEL} onPress={() => openLegalUrl(TERMS_URL)} />
            ) : null}
            <SettingsLinkRow role="link" label="Privacy Policy" onPress={() => openLegalUrl(PRIVACY_URL)} />
          </SettingsSection>
        </VStack>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: signingOut, disabled: signingOut }}
          disabled={signingOut}
          onPress={confirmSignOut}
          className="mt-[30px] h-[54px] flex-row items-center justify-center gap-2 rounded-[14px] border border-destructive/40 bg-destructive/10 active:opacity-80"
        >
          {signingOut ? <Spinner className="text-destructive" /> : null}
          <Text className="font-inter-semibold text-[16px] text-destructive">Sign out</Text>
        </Pressable>

        <VStack className="mt-[18px] items-center gap-1.5">
          <Pressable accessibilityRole="link" onPress={() => router.push('/profile/delete-account')} className="h-11 justify-center px-3">
            <Text className="font-inter text-[14px] text-muted-foreground underline">Delete account</Text>
          </Pressable>
          <Text className="font-inter text-[12px] text-faint">mintsy {Constants.expoConfig?.version}</Text>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
