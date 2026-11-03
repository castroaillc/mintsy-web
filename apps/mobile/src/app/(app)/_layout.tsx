import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { useOnboarding } from '@/lib/onboarding';
import { ProgressProvider } from '@/lib/progress';
import { registerForPushNotifications } from '@/lib/push';

export default function AppLayout() {
  const { permission } = useNotificationPermission();
  const { takePendingEpisode } = useOnboarding();

  // "Start Episode 1" at the end of onboarding: open it once the tabs are mounted
  useEffect(() => {
    const episodeId = takePendingEpisode();
    // Wait a frame so the tab navigator has finished mounting
    if (episodeId) requestAnimationFrame(() => router.push({ pathname: '/player/[episodeId]', params: { episodeId } }));
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the backend's copy of this device's push token current while signed in
  useEffect(() => {
    if (permission === 'granted') {
      registerForPushNotifications().catch((err) =>
        console.warn('Push registration failed:', err),
      );
    }
  }, [permission]);

  return (
    <ProgressProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* Covers the tab bar; the player's chevron button dismisses it */}
        <Stack.Screen name="player/[episodeId]" options={{ presentation: 'fullScreenModal' }} />
        {/* Premium: the paywall (close button top left) and, after a purchase, Welcome (replaces the paywall) */}
        <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="premium-welcome" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
    </ProgressProvider>
  );
}
