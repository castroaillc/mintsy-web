import { Stack } from 'expo-router';

export const unstable_settings = {
  anchor: 'welcome',
};

export default function AuthLayout() {
  // Each screen draws its own back button (see AuthScreen)
  return <Stack screenOptions={{ headerShown: false }} />;
}
