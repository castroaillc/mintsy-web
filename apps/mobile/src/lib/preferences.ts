import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { SPEEDS } from '@/hooks/use-playback-clock';
import { mergeKnownVoices, type KnownVoice } from '@/lib/voices';

/** Device-level playback, download and notification toggles. Saved on the device (SecureStore), not synced. */
export type Preferences = {
  autoplayNext: boolean;
  captionsByDefault: boolean;
  downloadOnWifiOnly: boolean;
  newSeriesAlerts: boolean;
  defaultSpeed: (typeof SPEEDS)[number];
  /** Preferred narrator; null plays each episode's default. Episodes that don't offer it use their default too. */
  defaultVoiceId: string | null;
  /** Narrators seen on this device, for Settings: the API has no list of them. */
  knownVoices: KnownVoice[];
};

const STORAGE_KEY = 'preferences';
const DEFAULTS: Preferences = {
  autoplayNext: true,
  captionsByDefault: false,
  downloadOnWifiOnly: true,
  newSeriesAlerts: true,
  defaultSpeed: 1,
  defaultVoiceId: null,
  knownVoices: [],
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

/** Remembers narrators an episode offered. Only writes when something new turned up. */
export function rememberVoices(voices: KnownVoice[]) {
  const isNew = voices.some((v) => !current.knownVoices.some((k) => k.id === v.id && k.name === v.name));
  if (isNew) setPreferences({ knownVoices: mergeKnownVoices(current.knownVoices, voices) });
}

/** Current values outside React (e.g. the Wi-Fi-only check before a download). */
export function getPreferences() {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences() {
  return useSyncExternalStore(subscribe, () => current);
}
