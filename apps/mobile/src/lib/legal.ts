import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/** Apple's standard EULA serves as mintsy's Terms of Use. Shown on iOS only; Android links Privacy alone. */
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const TERMS_LABEL = 'Terms of Use (EULA)';
export const SHOW_TERMS = Platform.OS === 'ios';
export const PRIVACY_URL = 'https://getmintsy.com/privacy';

/** Opens a legal page in the in-app browser. */
export function openLegalUrl(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
