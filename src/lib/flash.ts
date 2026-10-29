import { useSyncExternalStore } from 'react';

/**
 * One-off confirmation shown on the next screen that reads it (e.g. "Your account was deleted" on Welcome,
 * "Password updated" on Sign in). Lives in memory only.
 */
export type Flash = { key: string; message: string };

let current: Flash | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Shows `message` on the screen that reads `key` (see useFlash). */
export function setFlash(key: string, message: string) {
  current = { key, message };
  emit();
}

export function clearFlash(key: string) {
  if (current?.key !== key) return;
  current = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The pending message for `key`, if any. Call clearFlash(key) once it's been dismissed. */
export function useFlash(key: string) {
  const flash = useSyncExternalStore(subscribe, () => current);
  return flash?.key === key ? flash.message : null;
}
