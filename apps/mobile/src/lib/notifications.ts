import {
  AndroidImportance,
  getPermissionsAsync,
  IosAuthorizationStatus,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  SchedulableTriggerInputTypes,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationPermissionsStatus,
} from 'expo-notifications';
import { Platform } from 'react-native';

// Show notifications while the app is in the foreground
setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

function toPermission(
  response: NotificationPermissionsStatus,
): NotificationPermission {
  if (Platform.OS === 'ios') {
    // On iOS the root `status` doesn't reflect provisional/ephemeral authorization
    const status = response.ios?.status;
    if (
      status === IosAuthorizationStatus.AUTHORIZED ||
      status === IosAuthorizationStatus.PROVISIONAL ||
      status === IosAuthorizationStatus.EPHEMERAL
    ) {
      return 'granted';
    }
    if (status === IosAuthorizationStatus.DENIED) return 'denied';
    return 'undetermined';
  }
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'undetermined' : 'denied';
}

async function ensureAndroidChannel() {
  // Android 13+ won't show the permission prompt until a channel exists
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('default', {
      name: 'Default',
      importance: AndroidImportance.DEFAULT,
    });
  }
}

export async function getNotificationPermission() {
  return toPermission(await getPermissionsAsync());
}

export async function requestNotificationPermission() {
  await ensureAndroidChannel();
  return toPermission(
    await requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    }),
  );
}

export async function sendTestNotification() {
  await scheduleNotificationAsync({
    content: {
      title: 'Notifications are working',
      body: 'This is a test notification from Settings.',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
}
