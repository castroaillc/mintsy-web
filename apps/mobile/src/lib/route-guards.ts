/**
 * Which top-level route groups the root layout lets the viewer into. No imports, so
 * scripts/route-guards.test.mjs can check it under plain Node.
 *
 * Guests (signed out) use the app: browse, search, series pages and the free episodes need no account
 * (App Store guideline 5.1.1(v)). The auth screens open over the app when a guest asks for something
 * that needs an account, and close once they're signed in, so they land back where they were.
 */

export type RouteAccessInput = {
  signedIn: boolean;
  /** The signed-in user's onboarding answers have been read from the device. */
  onboardingLoaded: boolean;
  onboarded: boolean;
};

export type RouteAccess = {
  app: boolean;
  onboarding: boolean;
  auth: boolean;
  /** Where each group sends the viewer when its guard fails. */
  appRedirect: '/onboarding';
  onboardingRedirect: '/';
  authRedirect: '/' | '/onboarding';
};

export function routeAccess({ signedIn, onboardingLoaded, onboarded }: RouteAccessInput): RouteAccess {
  // Right after sign-in the answers take a moment to load: the auth screens stay up (and the app under them)
  // until they have, so an account that's already onboarded never flashes onboarding
  const signedInReady = signedIn && onboardingLoaded;
  return {
    // Guests, users still loading, and onboarded users; only a new account goes to onboarding first
    app: !signedInReady || onboarded,
    // Signed-in users who haven't finished it. Never guests
    onboarding: signedInReady && !onboarded,
    // Signed out (or just signed in and still loading)
    auth: !signedInReady,
    appRedirect: '/onboarding',
    onboardingRedirect: '/',
    authRedirect: onboarded ? '/' : '/onboarding',
  };
}

/** Why a guest is being asked for an account; shown on the Welcome screen that opens over the app. */
export const ACCOUNT_REASONS = {
  save: 'Create a free account to save series and episodes to My List. It follows you to every device.',
  subscribe:
    'Premium belongs to your mintsy account, so it unlocks every episode on all the devices you sign in on, including the web. Creating an account is free.',
  restore: 'Sign in to the mintsy account you subscribed with to restore Premium.',
} as const;

export type AccountReason = keyof typeof ACCOUNT_REASONS;

/** The message for a `reason` route param, or undefined when it's missing or unknown. */
export function accountReasonMessage(reason: string | string[] | undefined): string | undefined {
  const key = Array.isArray(reason) ? reason[0] : reason;
  return key && Object.hasOwn(ACCOUNT_REASONS, key) ? ACCOUNT_REASONS[key as AccountReason] : undefined;
}
