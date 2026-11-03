import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      // mintsy, mintsy-preview or mintsy-dev, depending on the build variant (see app.config.ts)
      scheme: Constants.expoConfig?.scheme as string,
      storagePrefix: 'mintsy',
      storage: SecureStore,
    }),
  ],
});
