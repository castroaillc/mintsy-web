import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { AuthScreen } from '@/components/auth/auth-screen';
import { BrandButton } from '@/components/mintsy/brand-button';
import { Spinner } from '@/components/mintsy/spinner';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { authClient } from '@/lib/auth-client';

type Outcome =
  | { kind: 'checking' }
  | { kind: 'changed'; email: string }
  | { kind: 'confirmed' }
  | { kind: 'error'; message: string };

/** Better Auth's `?error=` codes for the change-email link. */
const ERRORS: Record<string, string> = {
  TOKEN_EXPIRED: 'This confirmation link has expired.',
  INVALID_TOKEN: 'This confirmation link isn’t valid.',
  USER_NOT_FOUND: 'This confirmation link was already used.',
  INVALID_USER: 'This link belongs to a different account than the one signed in.',
};

/**
 * Opened by the change-email confirmation link, which goes to the new address: `<scheme>://email-changed`
 * on success, `<scheme>://email-changed/?error=CODE` on failure (see +native-intent for the slash).
 * Refreshes the session so the new address shows everywhere. Outside the auth guards.
 */
export default function EmailChangedScreen() {
  const { error } = useLocalSearchParams<{ error?: string }>();
  const { data: session, refetch } = authClient.useSession();
  const signedIn = !!session;
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (error) {
        setOutcome({ kind: 'error', message: ERRORS[error.toUpperCase()] ?? 'We couldn’t confirm your new email.' });
        return;
      }
      // Skip the cookie cache so the new address comes straight from the server
      await refetch({ query: { disableCookieCache: true } }).catch(() => {});
      const fresh = await authClient.getSession().catch(() => null);
      if (cancelled) return;
      const email = fresh?.data?.user.email;
      if (!email) return setOutcome({ kind: 'confirmed' });
      setOutcome({ kind: 'changed', email });
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [error, refetch]);

  const done = () => router.replace(signedIn ? '/profile/settings' : '/sign-in');
  const doneLabel = signedIn ? 'Back to settings' : 'Sign in';

  switch (outcome.kind) {
    case 'checking':
      return (
        <AuthScreen title="Confirming your email" subtitle="One moment…">
          <HStack className="justify-center pt-4">
            <Spinner className="text-muted-foreground" />
          </HStack>
        </AuthScreen>
      );
    case 'changed':
      return (
        <AuthScreen title="Email updated" subtitle={`You’ll now sign in with ${outcome.email}.`}>
          <BrandButton label={doneLabel} height={54} onPress={done} className="mt-2" />
        </AuthScreen>
      );
    case 'confirmed':
      return (
        <AuthScreen title="Email confirmed" subtitle="Sign in with your new email address.">
          <BrandButton label={doneLabel} height={54} onPress={done} className="mt-2" />
        </AuthScreen>
      );
    case 'error':
      return (
        <AuthScreen title="Couldn’t change your email" subtitle={outcome.message}>
          <Text className="font-inter text-[15px] leading-[23px] text-muted-foreground">
            Your email hasn’t changed. Start again from Settings › Email to get a new link.
          </Text>
          <BrandButton label={doneLabel} height={54} onPress={done} className="mt-2" />
        </AuthScreen>
      );
  }
}
