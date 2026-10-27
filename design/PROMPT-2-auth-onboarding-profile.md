Work in the existing Expo app at ~/Desktop/Software/mobile-app. Read AGENTS.md first and follow it (SDK 58: use the matching versioned docs before touching any Expo or Expo Router API; install only with `npx expo install`; run `npx expo lint` and `npx tsc --noEmit` before you finish).

This builds on design/PROMPT.md (browse, book series, player). If that work is already in the app, reuse its theme tokens, fonts and components (BrandButton, IconButton, ChipRow, ProgressBar, CoverTile…). If it isn't, set up the theme tokens and fonts as described there first.

## Design reference: read this first
Read design/README.md, then design files 4–13, before writing code. They are the source of truth for layout, sizes, spacing, colors, copy, mock data and interactions. Match them closely in dark mode and keep them legible in light mode. The README maps each file to a route.

## Scope
Frontend UI. Keep all existing auth logic: authClient.signUp.email / signIn.email, Better Auth's 8-character minimum, error handling, and the Stack.Protected guards in src/app/_layout.tsx. Restyle and extend; don't replace the auth mechanism. No new backend endpoints. Data that has no backend yet (interests, daily goal, reminder time, stats) is stored locally (see below) behind a small hook so it can move to the API later.

## 1. Auth (files 4–6): restyle the existing (auth) screens
- welcome.tsx: the "m." logo tile and "mintsy." wordmark, a fanned stack of three cover tiles with an "Episode 1 of 20 · 4:52" pill, the headline "Every great book, one 5-minute episode at a time.", the subcopy, Create account (brand) and Sign in (outline) buttons, and a Terms/Privacy line.
- sign-up.tsx: back button, "Create account" / "It only takes a minute.", Name / Email / Password fields with labels, a show/hide password toggle, the "Use at least 8 characters." helper, and a brand submit button with a loading state. Keep the current validation and error display, restyled.
- sign-in.tsx: "Welcome back" / "Sign in to pick up where you left off.", Email / Password with show/hide, a "Forgot password?" link (route it to a simple placeholder screen for now), the inline error alert as in the design (shown when signIn returns an error), and "New to mintsy? Create account".
- Update src/components/auth/auth-screen.tsx and text-field.tsx to the new look rather than duplicating them.

## 2. Onboarding (files 7–10): new flow after sign-up
- Add an onboarding route group with a Stack: interests → daily-time → reminders → first-series.
- Gate it in the root layout: signed in AND not yet onboarded → onboarding; signed in AND onboarded → (app). Store an `onboardingComplete` flag (plus the choices) per user id with expo-secure-store (already installed) or AsyncStorage via `npx expo install`, in a `useOnboarding` hook. Existing users who sign in on a device that has no flag go through onboarding once. Skip on any step marks progress and moves on; finishing step 4 sets the flag.
- Shared header: back chevron (not on step 1), a 4-segment progress bar, and Skip (not on step 4). "Step N of 4" label above each title.
- Interests: wrapping chips (Finance, Investing, Business, Leadership, Psychology, Productivity, Health, Science, History, Philosophy, Relationships, Creativity, Marketing, Startups). Selected = check + brand border. The pinned bottom button reads "Pick N more" (disabled) until 3 are chosen, then "Continue · N selected".
- Daily time: radio cards 5 / 15 / 30 min / "I'll decide as I go", with the live estimate line ("At 15 minutes a day, you'd finish a 20-chapter book in about 7 days.").
- Reminders: the example notification card, Morning 8:00 AM / Lunch 12:30 PM / Evening 8:00 PM options, "Turn on reminders" and "Not now". "Turn on reminders" reuses the app's existing notification permission flow (src/hooks/use-notification-permission.ts) and saves the chosen time. Scheduling the actual daily local notification is a stretch goal: if you do it, use expo-notifications (already installed) and follow the SDK 58 docs.
- First series: three recommended books from the mock catalog that match the chosen interests ("Because you picked Finance"), as radio cards. "Start Episode 1" completes onboarding and opens the Player for that book's first episode; "Browse all series instead" completes onboarding and goes to Home.

## 3. Profile (files 11–13)
- Replace the Settings tab with a Profile tab (person icon, SF Symbol "person" / "person.fill", Material "person") that contains a Stack: profile → edit, profile → settings. Final tabs: Home, Search, My List, Profile.
- Profile: title + settings gear button; avatar (initial from the session user's name), name, "Member since …" and Edit; three stat tiles (day streak, episodes watched, time learning); the "This week" bar chart against the daily goal (bars that met the goal in brand color); "In progress" books with progress bars (from the ProgressProvider if it exists, otherwise mock data); "Your interests" chips with Edit; and a list linking to My List, Downloads, Finished and Settings. Stats can come from mock data or be derived from the progress context.
- Edit profile: Cancel / "Edit profile" / Save header, avatar with "Change photo" (UI only, no upload yet), Name (prefilled from the session; save with authClient.updateUser if available in the installed Better Auth version, otherwise leave a TODO), Email (read-only for now, with the confirm-link note), a daily-goal segmented control, and interest chips. Saves go to the useOnboarding store.
- Settings: move the current Settings screen's working functionality into this design. Keep the existing theme mode control (System/Light/Dark via src/lib/theme-mode.tsx) and the existing notification permission handling, restyled as the grouped sections in the design: Account, Playback (toggles stored locally), Appearance, Notifications, Support. At the bottom: Sign out (calls the existing sign-out), "Delete account" (placeholder confirm dialog, no backend call) and the app version from expo-constants.

## Quality bar
- Reuse and extend existing components (src/components/ui, settings-section, segmented-control, auth components) instead of making parallel copies.
- 44px minimum touch targets; labels on every input; accessibilityRole="switch" / "radio" where the design uses them; accessibilityLabel on icon-only buttons.
- Sign up → onboarding → first episode, sign in → Home, and sign out → Welcome all work end to end on a dev build.
- Lint and typecheck pass.
