"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferences the API doesn't store yet, kept in this browser's localStorage per user:
 * onboarding interests and daily time (they order Home's category rows), the first series picked in
 * onboarding, playback settings and the transcript text size.
 */
export type Prefs = {
  interests: string[];
  /** Daily minutes from onboarding: 5, 15, 30, or 0 for "I'll decide as I go"; null = not answered. */
  dailyMinutes: number | null;
  firstSeriesId: string | null;
  onboarded: boolean;
  autoplay: boolean;
  captions: boolean;
  speed: number;
  /** Transcript reader size step 0-3 (16, 18, 20, 22 px). */
  textSize: number;
};

export const DEFAULT_PREFS: Prefs = {
  interests: [],
  dailyMinutes: null,
  firstSeriesId: null,
  onboarded: false,
  autoplay: true,
  captions: false,
  speed: 1,
  textSize: 0,
};

export const SPEEDS = [1, 1.25, 1.5, 2];

const listeners = new Set<() => void>();
const cache = new Map<string, Prefs>();

function storageKey(userId: string | null | undefined) {
  return `mintsy:prefs:${userId ?? "anon"}`;
}

function read(key: string): Prefs {
  const hit = cache.get(key);
  if (hit) return hit;
  let value = DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) value = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // Private mode or bad JSON: defaults
  }
  cache.set(key, value);
  return value;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("mintsy:prefs:")) {
      cache.delete(e.key);
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function writePrefs(userId: string | null | undefined, patch: Partial<Prefs>) {
  const key = storageKey(userId);
  const next = { ...read(key), ...patch };
  cache.set(key, next);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Storage full or disabled: keep it for this tab only
  }
  listeners.forEach((l) => l());
}

export function usePrefs(userId: string | null | undefined) {
  const key = storageKey(userId);
  const prefs = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => DEFAULT_PREFS,
  );
  const update = useCallback((patch: Partial<Prefs>) => writePrefs(userId, patch), [userId]);
  return [prefs, update] as const;
}

/** Onboarding topics (DeskOnbInterests). Only the first six are catalog categories today. */
export const INTEREST_TOPICS = [
  "Finance",
  "Business",
  "Psychology",
  "Productivity",
  "History",
  "Health",
  "Science",
  "Relationships",
  "Leadership",
  "Philosophy",
  "Creativity",
  "Biography",
];

/** Edit profile shows the first eight (DeskProfileEdit), plus any other the user already picked. */
export const PROFILE_TOPICS = INTEREST_TOPICS.slice(0, 8);

export const DAILY_OPTIONS = [
  { minutes: 5, big: "5", unit: "min", title: "1 episode a day", sub: "A quick daily habit", goal: "5 min" },
  { minutes: 15, big: "15", unit: "min", title: "3 episodes a day", sub: "Most popular", goal: "15 min" },
  { minutes: 30, big: "30", unit: "min", title: "6 episodes a day", sub: "Finish a book a week", goal: "30 min" },
  { minutes: 0, big: "–", unit: "", title: "I’ll decide as I go", sub: "No daily goal", goal: "No goal" },
] as const;
