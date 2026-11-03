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
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BrandButton } from '@/components/mintsy/brand-button';
import { Center } from '@/components/ui/center';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Text } from '@/components/ui/text';
import { authClient } from '@/lib/auth-client';
import { CatalogProvider, useCatalog } from '@/lib/catalog';
import { DownloadsProvider, useDownloads } from '@/lib/downloads';
import { OnboardingProvider, useOnboarding } from '@/lib/onboarding';
import { applyOrientationRule, useOrientationRule } from '@/lib/orientation';
import { PremiumProvider } from '@/lib/premium';
import { SavedProvider } from '@/lib/saved';
import { ThemeModeProvider, useThemeMode } from '@/lib/theme-mode';
// Registers the foreground notification handler
import '@/lib/notifications';

SplashScreen.preventAutoHideAsync();
// Before the first render, so a small window doesn't flash landscape on launch
applyOrientationRule();

export default function RootLayout() {
  useOrientationRule();

  return (
    <ThemeModeProvider>
      <CatalogProvider>
        {/* Configures RevenueCat once and follows the session (logIn / logOut) */}
        <PremiumProvider>
          {/* My List (API) and offline downloads (device), both per signed-in user */}
          <SavedProvider>
            <DownloadsProvider>
              <OnboardingProvider>
                <RootNavigator />
              </OnboardingProvider>
            </DownloadsProvider>
          </SavedProvider>
        </PremiumProvider>
      </CatalogProvider>
    </ThemeModeProvider>
  );
}

function RootNavigator() {
  const { data: session, isPending } = authClient.useSession();
  const { mode, isLoaded } = useThemeMode();
  const onboarding = useOnboarding();
  const catalog = useCatalog();
  const downloads = useDownloads();
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });
  // Only the first session check holds the app back. Later checks (e.g. signOut after deleteUser, when there's
  // already no session) report isPending again; unmounting the whole tree then would drop screen state such as
  // Welcome's "account deleted" notice.
  const [sessionKnown, setSessionKnown] = useState(false);
  if (!isPending && !sessionKnown) setSessionKnown(true);
  // A font load error falls back to system fonts rather than holding the splash screen
  const isReady = sessionKnown && isLoaded && (fontsLoaded || !!fontError) && catalog.status !== 'loading';
  // On a cold start with a session, also wait for the onboarding flag so the auth screens don't flash
  const canHideSplash = isReady && (!session || onboarding.isLoaded);

  useEffect(() => {
    if (canHideSplash) SplashScreen.hideAsync();
  }, [canHideSplash]);

  // Keep the splash screen up until we know the session, saved theme and fonts, and have the catalog
  if (!isReady) return null;

  // Offline at launch with downloads on the device: let a signed-in viewer in to watch them (Home shows an offline notice)
  const offlineWithDownloads = catalog.status === 'error' && !!session && downloads.items.length > 0;

  if (catalog.status === 'error' && !offlineWithDownloads) {
    return (
      <GluestackUIProvider mode={mode}>
        <Center className="flex-1 gap-4 bg-background px-8">
          <Text className="text-center font-display text-[20px] text-foreground">Couldn’t load mintsy</Text>
          <Text className="text-center font-inter text-[15px] text-muted-foreground">
            Check your connection and try again.
          </Text>
          <BrandButton label="Try again" onPress={catalog.retry} loading={catalog.retrying} className="self-stretch" />
        </Center>
      </GluestackUIProvider>
    );
  }

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
