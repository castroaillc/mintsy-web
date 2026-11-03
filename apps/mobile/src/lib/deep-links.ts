import * as Linking from 'expo-linking';

/**
 * Links that Better Auth's emails bring back into the app. The scheme follows the build
 * (`mintsy://` in production, `mintsy-dev://` in dev builds; see app.config.ts), so it's never hard-coded.
 */
export const RESET_PASSWORD_URL = Linking.createURL('reset-password');
export const EMAIL_CHANGED_URL = Linking.createURL('email-changed');
