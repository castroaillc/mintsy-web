import { router } from 'expo-router';

import { authClient } from '@/lib/auth-client';
import type { AccountReason } from '@/lib/route-guards';

/** True while nobody is signed in: the viewer is browsing as a guest. */
export function useIsGuest() {
  const { data: session } = authClient.useSession();
  return !session;
}

/**
 * Asks a guest to create an account or sign in, for something that needs one: Welcome opens over the current
 * screen with `reason` explained, and closes by itself once they're signed in (the root layout's guards), so
 * they're back where they were. A new account goes through onboarding first, as before.
 */
export function promptAccount(reason?: AccountReason) {
  router.push({ pathname: '/welcome', params: reason ? { reason } : {} });
}
