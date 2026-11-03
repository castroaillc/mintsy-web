import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Build variant, set per EAS build profile in eas.json and by scripts/eas-update.mjs (`eas update` doesn't read eas.json's env).
 * Unset means development, so production's identity is only ever used when asked for by name, and a typo fails here
 * rather than quietly building the wrong app. Distinct identifiers let all three be installed side by side.
 */
const VARIANTS = {
  development: {
    name: 'Mintsy Dev',
    bundleId: 'com.getmintsy.app.dev',
    scheme: 'mintsy-dev',
    icon: './assets/images/icon-dev.png',
    androidForeground: './assets/images/android-icon-foreground-dev.png',
    googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME_DEV,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV,
    // QR codes open `exp+mintsy`, so only the dev client should claim it (default true; written out to be plain)
    plugins: [['expo-dev-client', { addGeneratedScheme: true }] as [string, object]],
  },
  preview: {
    name: 'Mintsy Preview',
    bundleId: 'com.getmintsy.app.preview',
    scheme: 'mintsy-preview',
    icon: './assets/images/icon-preview.png',
    androidForeground: './assets/images/android-icon-foreground-preview.png',
    googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME_PREVIEW,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PREVIEW,
    plugins: [['expo-dev-client', { addGeneratedScheme: false }] as [string, object]],
  },
  production: {
    name: 'Mintsy',
    bundleId: 'com.getmintsy.app',
    scheme: 'mintsy',
    icon: './assets/images/icon.png',
    androidForeground: './assets/images/android-icon-foreground.png',
    googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    // Prebuild auto-applies expo-dev-client with its default, so production builds still claim `exp+mintsy`. Listing it
    // with `addGeneratedScheme: false` fixes that but changes the runtime: do it with the next production native build.
    plugins: [] as [string, object][],
  },
};
type AppVariant = keyof typeof VARIANTS;

const APP_VARIANT = (process.env.APP_VARIANT || 'development') as AppVariant;
const variant = VARIANTS[APP_VARIANT];
if (!variant) {
  throw new Error(`Unknown APP_VARIANT "${APP_VARIANT}". Use one of: ${Object.keys(VARIANTS).join(', ')}.`);
}

/**
 * Google Sign-In (iOS) opens the app back through the reversed iOS client ID, e.g.
 * `com.googleusercontent.apps.1234-abcd`. iOS client IDs are per bundle id, so each variant has its own:
 * EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME(_DEV|_PREVIEW), or derived from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID(_DEV|_PREVIEW)
 * (`1234-abcd.apps.googleusercontent.com`). Unset: the plugin is left out (it requires a scheme) and the app
 * hides the Google button. src/lib/social-auth.ts picks the matching client ID at runtime.
 */
function googleIosUrlScheme() {
  const explicit = variant.googleIosUrlScheme?.trim();
  if (explicit) return explicit;
  const clientId = variant.googleIosClientId?.trim();
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
  // The top-level icon is what iOS uses here: `ios.icon`, which would take precedence, isn't set
  icon: variant.icon,
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
      // Takes precedence over the top-level icon on Android, so it's per variant too
      foregroundImage: variant.androidForeground,
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
    ...variant.plugins,
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
    // Read by src/lib/variant.ts
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
