import { Platform, useWindowDimensions } from 'react-native';

/**
 * Window width (pt) from which screens use their wide layout. Covers both poses of iPhone Duo open
 * (669 upright, 951 rotated); stays above a folded or regular iPhone in portrait and the 469 Split View window.
 * A window whose shortest side reaches this also isn't locked to portrait (src/lib/orientation.ts).
 */
export const WIDE_MIN_WIDTH = 600;

/**
 * Below this window height (pt), landscape means a phone on its side. Covers iPhone Duo open (669) and leaves
 * full-size iPad windows (744 and up) out.
 */
export const SIDEWAYS_MAX_HEIGHT = 700;

/** Below this window height (pt), landscape has no status bar: regular iPhones and iPhone Duo folded. */
export const PHONE_SIDEWAYS_MAX_HEIGHT = 500;

/** Width (pt) of the system rail on iPhone Duo, which holds the status bar when the rail is drawn. */
export const RAIL_WIDTH = 84;

/** Left pane of the two-pane layouts, when the window has room for it (design: it ends near the fold). */
const WIDE_PANE_WIDTH = 456;

/** Max width of single-column forms (onboarding, auth) on wide windows. */
export const READABLE_MAX_WIDTH = 480;

/**
 * Layout class of the current window, read on every render so it follows folding,
 * rotation and Split View. Pick layouts from this, never from the device model.
 */
export function useWideLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_MIN_WIDTH;
  // Narrow wide windows (iPhone Duo open and upright) split evenly, so the right pane keeps a phone's width
  const paneWidth = Math.min(WIDE_PANE_WIDTH, Math.round(width / 2));
  const landscape = width > height;
  // Wide and short, with the system rail taking width too: iPhone Duo open and rotated
  const shortWide = wide && landscape && height >= PHONE_SIDEWAYS_MAX_HEIGHT && height < SIDEWAYS_MAX_HEIGHT;
  return { width, height, wide, landscape, shortWide, paneWidth, tightPanes: paneWidth < WIDE_PANE_WIDTH };
}

/** ArrangementView only lays its children out on iOS 27.1+; older systems render them without a container. */
export function supportsArrangementView() {
  if (Platform.OS !== 'ios') return false;
  const [major = 0, minor = 0] = String(Platform.Version).split('.').map(Number);
  return major > 27 || (major === 27 && minor >= 1);
}
