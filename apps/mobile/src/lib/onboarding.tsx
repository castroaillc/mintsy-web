import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { DailyGoal, Interest, ReminderTimeId } from '@/data/interests';
import { authClient } from '@/lib/auth-client';

/** Onboarding answers. Local only until the API has somewhere to keep them. */
export type OnboardingData = {
  onboardingComplete: boolean;
  /** Highest step the user has finished or skipped (0–4), so the flow resumes there. */
  stepsDone: number;
  interests: Interest[];
  dailyGoal: DailyGoal;
  remindersOn: boolean;
  reminderTime: ReminderTimeId;
};

const DEFAULTS: OnboardingData = {
  onboardingComplete: false,
  stepsDone: 0,
  interests: [],
  dailyGoal: 15,
  remindersOn: false,
  reminderTime: 'morning',
};

type OnboardingContextValue = {
  /** False until the signed-in user's saved answers have been read. */
  isLoaded: boolean;
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  /** Records that `step` (1–4) was finished or skipped, saving any answers with it. */
  markStep: (step: number, patch?: Partial<OnboardingData>) => void;
  /** Finishes onboarding; optionally opens an episode once the app tabs mount. */
  complete: (startEpisodeId?: string) => void;
  /** Read once by the app layout after onboarding finishes. */
  takePendingEpisode: () => string | undefined;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// SecureStore keys allow only alphanumerics, ".", "-" and "_"
const storageKey = (userId: string) => `onboarding.${userId.replace(/[^\w.-]/g, '_')}`;

/** Forgets a user's saved onboarding answers on this device (account deletion). */
export function clearOnboardingData(userId: string) {
  return SecureStore.deleteItemAsync(storageKey(userId)).catch(() => {});
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  const [state, setState] = useState<{ userId?: string; data: OnboardingData }>({ data: DEFAULTS });
  const [pendingEpisode, setPendingEpisode] = useState<string>();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    SecureStore.getItemAsync(storageKey(userId))
      .then((saved) => (saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS))
      .catch(() => DEFAULTS)
      .then((data: OnboardingData) => {
        if (!cancelled) setState({ userId, data });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Answers belong to whoever was loaded; anything else is stale or still loading
  const isLoaded = !!userId && state.userId === userId;
  const data = isLoaded ? state.data : DEFAULTS;

  const update = (patch: Partial<OnboardingData>) => {
    if (!userId) return;
    setState((prev) => {
      const next = { ...prev.data, ...patch };
      SecureStore.setItemAsync(storageKey(userId), JSON.stringify(next)).catch(() => {});
      return { userId, data: next };
    });
  };

  return (
    <OnboardingContext.Provider
      value={{
        isLoaded,
        data,
        update,
        markStep: (step, patch) => update({ ...patch, stepsDone: Math.max(data.stepsDone, step) }),
        complete: (startEpisodeId) => {
          setPendingEpisode(startEpisodeId);
          update({ onboardingComplete: true, stepsDone: 4 });
        },
        takePendingEpisode: () => {
          const id = pendingEpisode;
          if (id) setPendingEpisode(undefined);
          return id;
        },
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
