import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';

import { WIDE_MIN_WIDTH } from '@/hooks/use-wide-layout';

/** Screens currently asking to follow the phone: a count, so a focus handover between two can't drop the other's. */
let followers = 0;
/** The last lock sent to the native side, to skip repeats. Not a window size: that's read fresh each time. */
let requested: ScreenOrientation.OrientationLock | null = null;

/** The shortest side doesn't change on rotation, so the lock this picks can't flip itself back and forth. */
function isLargeWindow(width: number, height: number) {
  return Math.min(width, height) >= WIDE_MIN_WIDTH;
}

/**
 * The only place that sets the lock. Small windows (regular iPhones, iPhone Duo folded) stay upright unless the
 * player is on screen; large windows (iPhone Duo open) always follow the device. Picks from the current state, so
 * callers can run in any order.
 */
export function applyOrientationRule() {
  if (Platform.OS === 'web') return;
  const { width, height } = Dimensions.get('window');
  const lock =
    followers > 0 || isLargeWindow(width, height)
      ? ScreenOrientation.OrientationLock.DEFAULT
      : ScreenOrientation.OrientationLock.PORTRAIT_UP;
  if (lock === requested) return;
  requested = lock;
  ScreenOrientation.lockAsync(lock).catch((err) => {
    if (requested === lock) requested = null;
    console.warn('Failed to set screen orientation', err);
  });
}

/** Re-applies the rule when the window changes size class, e.g. folding or unfolding. Mount once, in the root layout. */
export function useOrientationRule() {
  const { width, height } = useWindowDimensions();
  const large = isLargeWindow(width, height);
  useEffect(() => {
    applyOrientationRule();
  }, [large]);
}

/** While the player is on screen, the UI follows the phone. Returns the function that ends this. */
export function followPhoneOrientation() {
  followers += 1;
  applyOrientationRule();
  return () => {
    followers -= 1;
    applyOrientationRule();
  };
}
