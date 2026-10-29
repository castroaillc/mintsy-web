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

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variant.name,
  slug: 'mintsy',
  owner: 'castroai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: variant.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: variant.bundleId,
    appleTeamId: '9496L7QUB2',
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
    output: 'server',
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
    ['expo-notifications', { defaultChannel: 'default' }],
    // Send feedback: in-app mail sheet (and mail app queries on Android)
    'expo-mail-composer',
  ],
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
