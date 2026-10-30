import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Pressable, useColorScheme } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Spinner } from '@/components/mintsy/spinner';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import {
  signInWithApple,
  signInWithGoogle,
  useSocialProviders,
  type SocialProvider,
  type SocialSignInResult,
} from '@/lib/social-auth';

const HEIGHT = 54;
const RADIUS = 14;

type SocialSignInProps = {
  /** Called with a message when sign-in fails, and with undefined when a new attempt starts. Cancelling calls neither. */
  onError: (message: string | undefined) => void;
  /** Where the "or" divider goes relative to the buttons; omit for none. */
  divider?: 'above' | 'below';
};

/**
 * "Continue with Apple" (iOS, first, per App Store guideline 4.8) and "Continue with Google" (when configured).
 * Renders nothing when neither is available, so dev builds without Google keys look like before.
 */
export function SocialSignIn({ onError, divider }: SocialSignInProps) {
  const providers = useSocialProviders();
  const dark = useColorScheme() === 'dark';
  const [busy, setBusy] = useState<SocialProvider>();

  if (!providers.any) return null;

  async function run(provider: SocialProvider, signIn: () => Promise<SocialSignInResult>) {
    if (busy) return;
    onError(undefined);
    setBusy(provider);
    let result: SocialSignInResult;
    try {
      result = await signIn();
    } catch {
      result = { status: 'error', message: 'We couldn’t sign you in. Try again.' };
    }
    // On success the session updates and the root layout's guard navigates away
    setBusy(undefined);
    if (result.status === 'error') onError(result.message);
  }

  const orDivider = (
    <HStack accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="items-center gap-3">
      <Box className="h-px flex-1 bg-border" />
      <Text className="font-inter text-[13px] text-faint">or</Text>
      <Box className="h-px flex-1 bg-border" />
    </HStack>
  );

  return (
    <VStack className="gap-3">
      {divider === 'above' ? orDivider : null}
      {providers.apple ? (
        <Box pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy && busy !== 'apple' ? 0.5 : 1 }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              dark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={RADIUS}
            style={{ width: '100%', height: HEIGHT }}
            onPress={() => run('apple', signInWithApple)}
          />
        </Box>
      ) : null}
      {providers.google ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{ busy: busy === 'google', disabled: !!busy }}
          disabled={!!busy}
          onPress={() => run('google', signInWithGoogle)}
          style={{ height: HEIGHT, borderRadius: RADIUS, opacity: busy && busy !== 'google' ? 0.5 : 1 }}
          className="flex-row items-center justify-center gap-2.5 border border-border-strong bg-card px-4 active:opacity-80"
        >
          {busy === 'google' ? <Spinner className="text-foreground" /> : <GoogleLogo />}
          <Text className="font-inter-semibold text-[16px] text-foreground">Continue with Google</Text>
        </Pressable>
      ) : null}
      {divider === 'below' ? orDivider : null}
    </VStack>
  );
}

/** The standard four-colour Google "G" (Google's sign-in branding guidelines). */
function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityElementsHidden>
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}
