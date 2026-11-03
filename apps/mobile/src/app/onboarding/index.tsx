import { Redirect } from 'expo-router';

import { useOnboarding } from '@/lib/onboarding';

const STEP_ROUTES = [
  '/onboarding/interests',
  '/onboarding/daily-time',
  '/onboarding/reminders',
  '/onboarding/first-series',
] as const;

/** Resumes at the first step the user hasn't finished or skipped. */
export default function OnboardingIndex() {
  const { data } = useOnboarding();
  return <Redirect href={STEP_ROUTES[Math.min(data.stepsDone, STEP_ROUTES.length - 1)]} />;
}
