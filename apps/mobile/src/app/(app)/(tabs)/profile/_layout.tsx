import { Stack } from 'expo-router';

import { authClient } from '@/lib/auth-client';

/** Profile tab stack: profile → edit (sheet), settings, finished, downloads, account screens. */
export default function ProfileStack() {
  const { data: session } = authClient.useSession();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Guests get a sign-in prompt plus the device settings here */}
      <Stack.Screen name="index" />
      {/* Everything else belongs to an account: closed on sign-out or deletion, and a link opened as a guest lands on Profile */}
      <Stack.Protected guard={!!session} redirectTo="/profile">
        <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="finished" />
        <Stack.Screen name="downloads" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="change-email" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="delete-account" />
      </Stack.Protected>
    </Stack>
  );
}
