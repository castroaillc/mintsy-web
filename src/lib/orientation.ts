import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform } from 'react-native';

function apply(lock: ScreenOrientation.OrientationLock) {
  if (Platform.OS === 'web') return;
  ScreenOrientation.lockAsync(lock).catch((err) => console.warn('Failed to set screen orientation', err));
}

/** The app's default: everything but the player stays upright. */
export function lockPortrait() {
  apply(ScreenOrientation.OrientationLock.PORTRAIT_UP);
}

/** While the player is on screen, the UI follows the phone. */
export function followPhoneOrientation() {
  apply(ScreenOrientation.OrientationLock.DEFAULT);
}
