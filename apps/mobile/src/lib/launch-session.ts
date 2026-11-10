import { storageAdapter } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { authClient, AUTH_STORAGE_PREFIX } from '@/lib/auth-client';
import { hasSessionCookie } from '@/lib/session-cookie';

/**
 * Whether the device held a live session cookie when the app started. Read once, synchronously, from the same
 * SecureStore entry `@better-auth/expo` uses (its adapter joins values split across keys). Null when it can't be
 * read (web, or the keychain is locked before first unlock): then the API's answer is awaited, as before.
 */
let launchCookie: boolean | null | undefined;
function hadSessionCookieAtLaunch(): boolean | null {
  if (launchCookie !== undefined) return launchCookie;
  if (Platform.OS === 'web') return (launchCookie = null);
  try {
    launchCookie = hasSessionCookie(storageAdapter(SecureStore).getItem(`${AUTH_STORAGE_PREFIX}_cookie`));
  } catch (err) {
    console.warn('Could not read the stored session', err);
    launchCookie = null;
  }
  return launchCookie;
}

/** Latched: once the first answer is in, later session refetches (which report isPending again) don't undo it. */
let known = false;

/**
 * The Better Auth session plus whether its first answer is in, without waiting for the network when the device
 * already knows:
 * - No session cookie stored: signed out. `/get-session` still goes out, but nothing waits for it.
 * - A cookie and the plugin's cached session (`mintsy_session_data`, restored before `/get-session` is sent): signed
 *   in as that user. The API's answer then confirms it, or signs out a session revoked elsewhere.
 * - A cookie but no cached session: wait for the API, as before.
 *
 * Shared by the root layout and the catalog, so both agree on when the viewer is known.
 */
export function useLaunchSession() {
  const { data: session, isPending } = authClient.useSession();
  if (!known && (!isPending || !!session || hadSessionCookieAtLaunch() === false)) known = true;
  return { session, known };
}
