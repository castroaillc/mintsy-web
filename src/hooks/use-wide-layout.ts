import { Platform, useWindowDimensions } from 'react-native';

/** Window width (pt) from which screens use their wide layout, e.g. iPhone Duo open. */
export const WIDE_MIN_WIDTH = 700;

/** Max width of single-column forms (onboarding, auth) on wide windows. */
export const READABLE_MAX_WIDTH = 480;

/**
 * Layout class of the current window, read on every render so it follows folding,
 * rotation and Split View. Pick layouts from this, never from the device model.
 */
export function useWideLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_MIN_WIDTH;
  return { width, height, wide, landscape: width > height };
}

/** ArrangementView only lays its children out on iOS 27.1+; older systems render them without a container. */
export function supportsArrangementView() {
  if (Platform.OS !== 'ios') return false;
  const [major = 0, minor = 0] = String(Platform.Version).split('.').map(Number);
  return major > 27 || (major === 27 && minor >= 1);
}
