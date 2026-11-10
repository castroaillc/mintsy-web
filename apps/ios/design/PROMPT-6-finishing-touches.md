# Prompt 6: finishing touches

Paste this into Claude Code from the `mobile-app` folder. Backend is at `../backend`.

---

Read `design/README.md`, then build the finishing touches shown in these design files. They are design
mockups, not code: match the layout, spacing, copy and colors, and map colors to the tokens in `src/global.css`.

- `design/68-toasts.dc.html`
- `design/2-book-series.dc.html` (updated: Episodes / Transcripts / About tabs) with `70-series-transcripts-tab.dc.html` and `71-series-about-tab.dc.html`
- `design/11-profile.dc.html` (updated: free upgrade card) and `69-profile-premium.dc.html` (Premium badge)
- `design/72-emails.dc.html` (backend)
- `design/73-notifications.dc.html` (app + backend)
- `design/67-user-journeys.dc.html` for the full picture of where each piece is used

## 1. Toasts (68)
- One shared `Toast` provider at the root layout plus a `useToast()` hook: `toast.show({ text, action?, onAction?, tone? })`.
- Light card (`#F2F2F5` on the dark app), 12pt above the tab bar or the bottom safe-area inset, one at a time
  (a new one replaces the current), 4 s, or 6 s when it has an action. Swipe down to dismiss.
- Announce with `AccessibilityInfo.announceForAccessibility`. Respect Reduce Motion (fade instead of slide).
- Wire up the 6 variants: Saved / Removed from My List (Undo), episode downloaded (Watch), daily goal met
  (accent tone), takeaway copied, and error (Retry, red tone).
- On iPhone Duo the toast spans only the pane it came from.

## 2. Series page tabs (2, 70, 71)
- Tabs Episodes / Transcripts / About under the hero, with `?tab=` as the initial tab so deep links work.
- Transcripts: search field, then one row per episode. For free users, rows after Episode 3 show a lock and
  open the paywall; otherwise they open the transcript reader at that episode.
- About: book description, "What you'll learn", author card, details rows, licensing note. Placeholder text in
  brackets (e.g. `[AUTHOR BIO]`) comes from the backend `Book` type; add any missing fields to the GraphQL schema
  and resolvers in `../backend`, leaving them null-safe.

## 3. Profile plan states (11, 69)
- Read the entitlement from the existing RevenueCat/`usePremium` hook from Prompt 4.
- Premium: PREMIUM badge next to the name, linking to Plan details, and the "Member since" line.
- Free: the "Unlock every episode" card linking to the paywall. No badge.

## 4. Emails (72, backend)
- In `../backend`, add three templates in the existing email sender (better-auth's `sendResetPassword` and
  `sendChangeEmailVerification` hooks for the first two). Use table-based, inline-styled HTML plus a plain-text part.
- Reset link expires in 1 hour; email-change link in 24 hours and also notify the old address.
- Trial-ending email: send once, 2 days before trial end, driven by RevenueCat webhooks
  (`INITIAL_PURCHASE` with `period_type: TRIAL` → schedule; `CANCELLATION`/`EXPIRATION` → cancel).
- Leave `[YOUR DOMAIN]`, `[TRIAL END DATE]`, `[YEARLY PRICE]`, `[COMPANY NAME AND MAILING ADDRESS]` as config
  values; don't invent them.

## 5. Push notifications (73)
- `expo-notifications`: ask for permission at the onboarding reminders step only (already designed), store the
  Expo push token on the user via a GraphQL mutation.
- Local notification for the daily reminder at the user's chosen time; server-sent pushes for the rest.
- Each notification carries a `url` in its data (e.g. `mintsy://player/[bookId]?episode=5`); handle taps with
  `Notifications.addNotificationResponseReceivedListener` and `getLastNotificationResponseAsync` for cold start,
  and route through the auth gate so signed-out users sign in first, then land there.
- Landing rules from the table: free user at Episode 4 → the Episode 3 upsell; finished series → Series complete.
- Backend rules: at most 2 a day (trial-ending always sends), quiet hours 9 PM–8 AM local except the user's own
  reminder time, skip the reminder/streak nudge once today's goal is met. Respect the Settings toggles.

Work in small commits, one section at a time, and run the type check after each.
