import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/lib/notifications';

/** Current notification permission, re-checked when the app returns from the system Settings app. */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>();

  const refresh = useCallback(() => {
    getNotificationPermission().then(setPermission);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, request };
}
