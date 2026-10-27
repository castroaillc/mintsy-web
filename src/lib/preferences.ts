import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { SPEEDS } from '@/hooks/use-playback-clock';

/** Device-level playback and notification toggles. Local only for now. */
export type Preferences = {
  autoplayNext: boolean;
  captionsByDefault: boolean;
  downloadOnWifiOnly: boolean;
  newSeriesAlerts: boolean;
  defaultSpeed: (typeof SPEEDS)[number];
};

const STORAGE_KEY = 'preferences';
const DEFAULTS: Preferences = {
  autoplayNext: true,
  captionsByDefault: false,
  downloadOnWifiOnly: true,
  newSeriesAlerts: true,
  defaultSpeed: 1,
};

let current = DEFAULTS;
const listeners = new Set<() => void>();

SecureStore.getItemAsync(STORAGE_KEY)
  .then((saved) => {
    if (saved) setPreferences(JSON.parse(saved));
  })
  .catch(() => {});

export function setPreferences(patch: Partial<Preferences>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(current)).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences() {
  return useSyncExternalStore(subscribe, () => current);
}
