import '@/global.css';

// Per-weight imports so only the weights in use are bundled
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { authClient } from '@/lib/auth-client';
import { OnboardingProvider, useOnboarding } from '@/lib/onboarding';
import { ThemeModeProvider, useThemeMode } from '@/lib/theme-mode';
// Registers the foreground notification handler
import '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <OnboardingProvider>
        <RootNavigator />
      </OnboardingProvider>
    </ThemeModeProvider>
  );
}

function RootNavigator() {
  const { data: session, isPending } = authClient.useSession();
  const { mode, isLoaded } = useThemeMode();
  const onboarding = useOnboarding();
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  // A font load error falls back to system fonts rather than holding the splash screen
  const isReady = !isPending && isLoaded && (fontsLoaded || !!fontError);
  // On a cold start with a session, also wait for the onboarding flag so the auth screens don't flash
  const canHideSplash = isReady && (!session || onboarding.isLoaded);

  useEffect(() => {
    if (canHideSplash) SplashScreen.hideAsync();
  }, [canHideSplash]);

  // Keep the splash screen up until we know the session, saved theme and fonts
  if (!isReady) return null;

  const isSignedIn = !!session;
  // Right after sign-in the user's onboarding answers take a moment to load; stay on the auth screens until they do
  const isSignedInReady = isSignedIn && onboarding.isLoaded;
  const isOnboarded = onboarding.data.onboardingComplete;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode={mode}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected
              guard={isSignedInReady && isOnboarded}
              redirectTo={isSignedIn ? '/onboarding' : '/welcome'}
            >
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            <Stack.Protected
              guard={isSignedInReady && !isOnboarded}
              redirectTo={isSignedIn ? '/' : '/welcome'}
            >
              <Stack.Screen name="onboarding" />
            </Stack.Protected>
            <Stack.Protected guard={!isSignedInReady} redirectTo={isOnboarded ? '/' : '/onboarding'}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}
