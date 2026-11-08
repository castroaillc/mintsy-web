import { Stack } from 'expo-router';

/**
 * Welcome, sign-in, sign-up and forgot password. Opened over the app (fullScreenModal, see the root layout) when a
 * guest asks for something that needs an account, so there's no anchor: Profile's "Sign in" opens just that form,
 * and its back button returns to the app.
 */
export default function AuthLayout() {
  // Each screen draws its own back button (see AuthScreen)
  return <Stack screenOptions={{ headerShown: false }} />;
}
