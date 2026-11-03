import Constants from 'expo-constants';

export type AppVariant = 'development' | 'preview' | 'production';

/**
 * Which app this is, from `extra.appVariant` in app.config.ts. A development build reads the config from the dev
 * server, so it follows the server's APP_VARIANT: run `expo start` with the variant of the build you open.
 */
const value = Constants.expoConfig?.extra?.appVariant;
export const APP_VARIANT: AppVariant = value === 'production' || value === 'preview' ? value : 'development';
