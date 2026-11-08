import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Platform, TurboModuleRegistry } from 'react-native';

import { linkedAppleAccountIds } from '@/lib/apple-identity';
import { authClient } from '@/lib/auth-client';
import { APP_VARIANT } from '@/lib/variant';

/**
 * Native "Sign in with Apple" / "Sign in with Google": the provider's SDK returns an ID token and Better Auth's
 * `signIn.social({ provider, idToken })` exchanges it for the same session as email sign-in (no browser redirect).
 * On success the session signal fires and the root layout's guard, catalog and Premium follow it as usual.
 */

export type SocialProvider = 'apple' | 'google';

/** `cancelled` isn't an error: the screen stays put with no message. */
export type SocialSignInResult = { status: 'success' } | { status: 'cancelled' } | { status: 'error'; message: string };

// iOS client IDs are per bundle id, so each variant has its own. No fallback between them: a client ID only works in
// the app it was issued for, so a variant without one hides the button. The web client ID is shared.
// All names are written out so Expo inlines them at build time.
const GOOGLE_IOS_CLIENT_ID = {
  development: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV,
  preview: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PREVIEW,
  production: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
}[APP_VARIANT];
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

const GENERIC_ERROR = 'We couldn’t sign you in. Try again.';
const CONNECTION_ERROR = 'Check your connection and try again.';

/** Backend answers for `POST /sign-in/social` with an ID token (confirmed by the backend agent). */
const SERVER_MESSAGES: Record<string, (provider: string) => string> = {
  // 404: provider not configured on the server
  PROVIDER_NOT_FOUND: (p) => `Sign in with ${p} isn’t available right now. Use your email instead.`,
  // 401: an email + password account already uses this address and isn't linked
  OAUTH_LINK_ERROR: () =>
    'An account with this email already exists. Sign in with your email and password instead.',
  // 401 INVALID_TOKEN, USER_EMAIL_NOT_FOUND and anything else: generic
};

/**
 * Google needs the web client ID (the ID token's audience the backend checks) on both platforms, and the iOS
 * client ID on iOS. Builds made before the native module was added don't have it, so check before importing:
 * the package looks its module up eagerly and would throw on import.
 */
const GOOGLE_CONFIGURED =
  (Platform.OS === 'ios' || Platform.OS === 'android') &&
  !!GOOGLE_WEB_CLIENT_ID &&
  (Platform.OS !== 'ios' || !!GOOGLE_IOS_CLIENT_ID) &&
  TurboModuleRegistry.get('RNGoogleSignin') != null;

/** Which social buttons to show. Apple only where the OS offers it (iOS); on iOS Google only alongside Apple (App Store 4.8). */
export function useSocialProviders() {
  const [apple, setApple] = useState(false);
  const [checked, setChecked] = useState(Platform.OS !== 'ios');

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .catch(() => false)
      .then((available) => {
        if (!alive) return;
        setApple(available);
        setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const google = checked && GOOGLE_CONFIGURED && (Platform.OS !== 'ios' || apple);
  return { apple, google, any: apple || google };
}

type BetterAuthError = { code?: string; message?: string; status?: number } | null | undefined;

function serverError(error: BetterAuthError, provider: SocialProvider): SocialSignInResult {
  if (!error?.status) return { status: 'error', message: CONNECTION_ERROR };
  const known = error.code ? SERVER_MESSAGES[error.code] : undefined;
  if (known) return { status: 'error', message: known(providerLabel(provider)) };
  if (error.status === 404) return { status: 'error', message: SERVER_MESSAGES.PROVIDER_NOT_FOUND(providerLabel(provider)) };
  return { status: 'error', message: GENERIC_ERROR };
}

function isCode(err: unknown, ...codes: string[]) {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' && codes.includes(code);
}

/** A credential from the Apple sheet, not yet sent to the backend. Single use: the authorization code expires in ~5 minutes. */
export type AppleCredential = {
  credential: AppleAuthentication.AppleAuthenticationCredential & { identityToken: string };
  /** Apple puts sha256(nonce) in the ID token; Better Auth gets this raw nonce and compares its hash */
  rawNonce: string;
};

export type AppleCredentialResult =
  | ({ status: 'success' } & AppleCredential)
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/** Step 1 of Sign in with Apple: show Apple's sheet and get the credential. Nothing is sent to the backend. */
export async function getAppleCredential(): Promise<AppleCredentialResult> {
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if (isCode(err, 'ERR_REQUEST_CANCELED')) return { status: 'cancelled' };
    console.warn('Apple sign-in failed:', err);
    return { status: 'error', message: GENERIC_ERROR };
  }
  const { identityToken } = credential;
  if (!identityToken) return { status: 'error', message: GENERIC_ERROR };
  return { status: 'success', credential: { ...credential, identityToken }, rawNonce };
}

/** Step 2 of Sign in with Apple: exchange the credential for a mintsy session (signs in, or creates the account). */
export async function signInWithAppleCredential({ credential, rawNonce }: AppleCredential): Promise<SocialSignInResult> {
  // Apple shares the name only on the very first sign-in, and only here (it isn't in the ID token)
  const firstName = credential.fullName?.givenName?.trim() || undefined;
  const lastName = credential.fullName?.familyName?.trim() || undefined;
  const hasName = !!(firstName || lastName);

  try {
    // Without user.name a new account's name is stored as ""
    const { error } = await authClient.signIn.social({
      provider: 'apple',
      idToken: {
        token: credential.identityToken,
        nonce: rawNonce,
        ...(hasName ? { user: { name: { firstName, lastName } } } : {}),
      },
      // Apple's one-time code: the backend exchanges it for a refresh token so it can revoke it when the account is
      // deleted (App Store 5.1.1(v)). Single use and valid ~5 minutes, so it goes straight out with the ID token.
      ...(credential.authorizationCode
        ? { additionalData: { appleAuthorizationCode: credential.authorizationCode } }
        : {}),
    });
    if (error) return serverError(error, 'apple');
    return { status: 'success' };
  } catch {
    return { status: 'error', message: CONNECTION_ERROR };
  }
}

/** Sign in with Apple from the auth screens: the sheet, then the backend. */
export async function signInWithApple(): Promise<SocialSignInResult> {
  const result = await getAppleCredential();
  if (result.status !== 'success') return result;
  return signInWithAppleCredential(result);
}

let googleConfigured = false;

export async function signInWithGoogle(): Promise<SocialSignInResult> {
  if (!GOOGLE_CONFIGURED) return { status: 'error', message: GENERIC_ERROR };
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await import(
    '@react-native-google-signin/google-signin'
  );
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
    googleConfigured = true;
  }

  let idToken: string | null;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { status: 'cancelled' };
    idToken = response.data.idToken;
  } catch (err) {
    if (isErrorWithCode(err) && (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS)) {
      return { status: 'cancelled' };
    }
    console.warn('Google sign-in failed:', err);
    return { status: 'error', message: GENERIC_ERROR };
  } finally {
    // The app keeps its own session; don't leave a Google one behind (the next sign-in shows the account picker again)
    GoogleSignin.signOut().catch(() => {});
  }
  if (!idToken) return { status: 'error', message: GENERIC_ERROR };

  try {
    const { error } = await authClient.signIn.social({ provider: 'google', idToken: { token: idToken } });
    return error ? serverError(error, 'google') : { status: 'success' };
  } catch {
    return { status: 'error', message: CONNECTION_ERROR };
  }
}

/** Run the provider's sign-in again (e.g. to refresh the session before deleting the account). */
export function signInWith(provider: string | null | undefined): Promise<SocialSignInResult> | null {
  if (provider === 'apple' && Platform.OS === 'ios') return signInWithApple();
  if (provider === 'google' && GOOGLE_CONFIGURED) return signInWithGoogle();
  return null;
}

/** Display name for a provider id from `listAccounts()`. */
export function providerLabel(providerId: string | null | undefined) {
  if (providerId === 'apple') return 'Apple';
  if (providerId === 'google') return 'Google';
  return providerId ?? 'another account';
}

type LinkedAccounts = {
  loading: boolean;
  /** True when the user has an email + password (`credential`) account. Assumed true until known or if loading fails. */
  hasPassword: boolean;
  /** The first social provider linked, for "You sign in with Apple". */
  socialProvider: string | null;
  /** True when an Apple account is linked (deleting it then re-runs Sign in with Apple so the backend can revoke). */
  hasApple: boolean;
  /** The linked Apple accounts' `accountId` (the Apple user id, `sub`). Empty while loading or if loading failed. */
  appleAccountIds: string[];
};

const NO_APPLE_IDS: string[] = [];

/** The current user's sign-in methods (Better Auth `listAccounts()`). */
export function useLinkedAccounts(): LinkedAccounts {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [state, setState] = useState<LinkedAccounts & { userId?: string }>({
    loading: true,
    hasPassword: true,
    socialProvider: null,
    hasApple: false,
    appleAccountIds: NO_APPLE_IDS,
  });

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    authClient
      .listAccounts()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !Array.isArray(data)) {
          setState({ userId, loading: false, hasPassword: true, socialProvider: null, hasApple: false, appleAccountIds: NO_APPLE_IDS });
          return;
        }
        const ids = data.map((a) => (a as { providerId?: string }).providerId);
        setState({
          userId,
          loading: false,
          hasPassword: ids.includes('credential'),
          socialProvider: ids.find((id): id is string => !!id && id !== 'credential') ?? null,
          hasApple: ids.includes('apple'),
          appleAccountIds: linkedAppleAccountIds(data),
        });
      })
      .catch(() => {
        if (alive) setState({ userId, loading: false, hasPassword: true, socialProvider: null, hasApple: false, appleAccountIds: NO_APPLE_IDS });
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // A different user than the one loaded: still loading
  if (state.userId !== userId) {
    return { loading: true, hasPassword: true, socialProvider: null, hasApple: false, appleAccountIds: NO_APPLE_IDS };
  }
  return {
    loading: state.loading,
    hasPassword: state.hasPassword,
    socialProvider: state.socialProvider,
    hasApple: state.hasApple,
    appleAccountIds: state.appleAccountIds,
  };
}
