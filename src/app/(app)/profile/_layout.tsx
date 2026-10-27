import { Stack } from 'expo-router';

/** Profile stack, pushed over the tabs from the Browse header: profile → edit (sheet), settings, finished. */
export default function ProfileStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
