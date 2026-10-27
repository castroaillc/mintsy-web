import Constants from 'expo-constants';
import { getExpoPushTokenAsync } from 'expo-notifications';
import { Platform } from 'react-native';

import { graphql } from './graphql';
import { getNotificationPermission } from './notifications';

let registeredToken: string | undefined;

function getProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Fetches this device's Expo push token and saves it for the signed-in user.
 * No-op unless notification permission is granted. Returns the token, if any.
 */
export async function registerForPushNotifications() {
  if ((await getNotificationPermission()) !== 'granted') return undefined;

  const projectId = getProjectId();
  if (!projectId) throw new Error('Missing EAS projectId in app config (run `eas init`)');

  const { data: token } = await getExpoPushTokenAsync({ projectId });
  if (token !== registeredToken) {
    await graphql(
      'mutation Register($token: String!, $platform: String!) { registerPushToken(token: $token, platform: $platform) }',
      { token, platform: Platform.OS },
    );
    registeredToken = token;
  }
  return token;
}

/** Removes this device's token from the backend. Call before signing out, while the session is still valid. */
export async function unregisterPushNotifications() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = undefined;
  await graphql('mutation Unregister($token: String!) { unregisterPushToken(token: $token) }', {
    token,
  }).catch(() => {});
}

export async function sendTestPush() {
  const data = await graphql<{ sendTestPush: number }>('mutation { sendTestPush }');
  return data.sendTestPush;
}
