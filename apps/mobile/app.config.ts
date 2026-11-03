import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Build variant, set per EAS build profile in eas.json.
 * Local `expo start` / `expo run:*` default to development.
 */
const APP_VARIANT = process.env.APP_VARIANT === 'production' ? 'production' : 'development';
const IS_DEV = APP_VARIANT === 'development';

// Distinct identifiers let the dev and production apps be installed side by side
const variant = IS_DEV
  ? { name: 'Mintsy Dev', bundleId: 'com.getmintsy.app.dev', scheme: 'mintsy-dev' }
  : { name: 'Mintsy', bundleId: 'com.getmintsy.app', scheme: 'mintsy' };

/**
 * Google Sign-In (iOS) opens the app back through the reversed iOS client ID, e.g.
 * `com.googleusercontent.apps.1234-abcd`. iOS client IDs are per bundle id, so each variant has its own:
 * EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME(_DEV), or derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID(_DEV)
 * (`1234-abcd.apps.googleusercontent.com`). Unset: the plugin is left out (it requires a scheme) and the app
 * hides the Google button. src/lib/social-auth.ts picks the matching client ID at runtime.
 */
function googleIosUrlScheme() {
  const env = IS_DEV
    ? { scheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME_DEV, clientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV }
    : { scheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME, clientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID };
  const explicit = env.scheme?.trim();
  if (explicit) return explicit;
  const clientId = env.clientId?.trim();
  const suffix = '.apps.googleusercontent.com';
  if (clientId?.endsWith(suffix)) return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
  return undefined;
}
const GOOGLE_IOS_URL_SCHEME = googleIosUrlScheme();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variant.name,
  slug: 'mintsy',
  owner: 'castroai',
  version: '1.0.0',
  // Small windows stay portrait except in the player; large windows and the player follow the device (src/lib/orientation.ts)
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: variant.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: variant.bundleId,
    appleTeamId: '9496L7QUB2',
    // Sign in with Apple capability (com.apple.developer.applesignin entitlement)
    usesAppleSignIn: true,
    infoPlist: {
      // Only standard (exempt) encryption such as HTTPS; skips the export compliance prompt
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: variant.bundleId,
    adaptiveIcon: {
      backgroundColor: '#181626',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0E0D18',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-secure-store',
    ['expo-screen-orientation', { initialOrientation: 'PORTRAIT_UP' }],
    ['expo-notifications', { defaultChannel: 'default' }],
    // Send feedback: in-app mail sheet (and mail app queries on Android)
    'expo-mail-composer',
    'expo-apple-authentication',
    // Sign in with Google without Firebase: only the iOS URL scheme is needed (Android uses the web client ID)
    ...(GOOGLE_IOS_URL_SCHEME
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }] as [string, object]]
      : []),
  ],
  // EAS Update. The fingerprint changes with the native code, so an update only reaches builds it can run on.
  runtimeVersion: { policy: 'fingerprint' },
  updates: {
    url: 'https://u.expo.dev/9866b510-720d-449d-8579-10ee29cbfcab',
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appVariant: APP_VARIANT,
    router: {
      asyncRoutes: {
        web: true,
      },
    },
    eas: {
      projectId: '9866b510-720d-449d-8579-10ee29cbfcab',
    },
  },
});
