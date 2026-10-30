import { Stack } from 'expo-router';

/** Profile tab stack: profile → edit (sheet), settings, finished, downloads, account screens. */
export default function ProfileStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
