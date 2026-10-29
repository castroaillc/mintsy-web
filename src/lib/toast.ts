import { useSyncExternalStore } from 'react';

/** A short confirmation at the bottom of the screen, e.g. "Saved to My List · Undo". In memory only. */
export type Toast = { id: number; message: string; actionLabel?: string; onAction?: () => void };

/** How long a toast stays up. */
export const TOAST_DURATION_MS = 4000;

let current: Toast | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function showToast(toast: Omit<Toast, 'id'>) {
  current = { ...toast, id: nextId++ };
  if (timer) clearTimeout(timer);
  timer = setTimeout(hideToast, TOAST_DURATION_MS);
  emit();
}

export function hideToast() {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToast() {
  return useSyncExternalStore(subscribe, () => current);
}
