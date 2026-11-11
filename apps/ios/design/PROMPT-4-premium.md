Build mintsy Premium: the free tier, the paywall, purchases and the subscription screens, across ~/Desktop/Software/mobile-app and ~/Desktop/Software/backend.

Read first:
- mobile-app/AGENTS.md (SDK 58: check the versioned docs before touching any Expo API; install only with `npx expo install`).
- design/README.md and design files 17–19 (phone) and 32–34 (iPhone Duo): free-tier series page, paywall, Welcome to Premium. Match them closely.
- RevenueCat's Expo guide: https://www.revenuecat.com/docs/getting-started/installation/expo. Check the current docs for every RevenueCat API named below; names here are a guide, not gospel.
- Explore the existing app and backend before writing code. Much of the app is already built (tabs, player, profile, onboarding, GraphQL catalog); extend what's there.

## The business rule
- Free accounts: the first 3 episodes of every book (episode number ≤ 3). Put `FREE_EPISODES = 3` in one shared constant on each side (app and backend).
- Premium (monthly or yearly subscription, with a free trial): every episode, full transcripts and takeaways, downloads.
- Prices, trial length and the yearly savings % come from the stores via RevenueCat. Never hard-code them; the design's [BRACKETED] placeholders are filled from the offering at runtime.

## Part A: App (mobile-app)
1. Install `react-native-purchases` with `npx expo install` (add `react-native-purchases-ui` only if you use its Customer Center; the paywall itself is custom, built from design files 18 and 33). It needs a development build; Expo Go only runs a preview mode with mock data.
2. Configure once in the root layout with the platform API key from env (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`; add both to .env.example). Identify the customer as the Better Auth user id: `Purchases.logIn(user.id)` when a session exists, `Purchases.logOut()` on sign-out. Never purchase anonymously.
3. `usePremium()` hook (context provider): exposes `isPremium`, `expiresAt`, `willRenew`, `periodType` (trial or normal), `productId`, `loading`, plus `purchase(pkg)`, `restore()` and `refresh()`. Source of truth on the device is RevenueCat customer info (entitlement id `premium`), kept fresh with its customer-info update listener; the backend's `me.premium` (Part B) is the source of truth for content access.
4. Free-tier locks (design 17 / 32):
   - Series page: episodes 1–3 labeled "Free", 4+ show a lock, "Premium", and "Unlock with Premium". The main button becomes "Unlock Episode 4 with Premium" when the next episode is locked.
   - Player: opening a locked episode (deep link, Up next, auto-advance, Continue watching) never plays it; route to the paywall instead. When Episode 3 ends for a free user, show an end-of-episode upsell inside the player ("Episode 4 is part of Premium" + Continue with Premium / Not now). It isn't designed yet; build it from the paywall's styles.
   - Downloads and the Full transcript are Premium-only; their buttons open the paywall for free users.
5. Paywall (design 18 / 33): a modal route. Load the current offering (`default`) with packages `$rc_annual` and `$rc_monthly`. Show each package's localized price string, the yearly per-month equivalent, the savings %, and the trial length from the intro offer, with a loading skeleton and an error/retry state. The CTA reads "Start <trial> free trial" when a trial is available, otherwise "Continue". Keep the App Store-required text: price and period, auto-renew terms, Restore purchases, Terms and Privacy links. A user-cancelled purchase is not an error (show nothing). Anything else shows a friendly message. On success, refresh entitlements (app and backend) and go to Welcome to Premium.
6. Welcome to Premium (design 19 / 34): the trial end date from customer info, "Play Episode N" for the episode they were blocked on (pass it through the paywall route), and Go to Home.
7. Subscription management (not designed; follow the Settings look):
   - Settings › Account › Subscription row shows "Free · Upgrade" (opens the paywall) or "Premium · Yearly" (opens Plan details).
   - Plan details screen: plan name, price, renews/expires date or trial end date, "Manage subscription" (open the store's subscription management via RevenueCat's management URL or manage-subscriptions call), and Restore purchases.
   - Profile shows a small "Premium" badge next to the name for subscribers.
8. iPhone Duo: the paywall and Welcome screens use the two-pane layout from design files 33–34 (see PROMPT-3).

## Part B: Backend (backend: Express + Apollo GraphQL + MongoDB + Better Auth)
1. Entitlements collection keyed by Better Auth user id: `{ userId, active, productId, periodType, expiresAt, willRenew, store, updatedAt }`.
2. RevenueCat webhook: `POST /webhooks/revenuecat`, mounted before the GraphQL middleware. Verify the Authorization header against `REVENUECAT_WEBHOOK_AUTH` (add to env.ts and .env.example). Handle at least INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, CANCELLATION, UNCANCELLATION, EXPIRATION, BILLING_ISSUE, TRANSFER. `app_user_id` is the Better Auth user id. Be idempotent (store event ids) and order-safe: use the event timestamps, and when in doubt refetch the subscriber from the RevenueCat REST API (`REVENUECAT_SECRET_API_KEY`, server-side only) and store that.
3. GraphQL:
   - `type Premium { active: Boolean!, expiresAt: String, willRenew: Boolean!, periodType: String, productId: String }` and `me { premium: Premium! }`.
   - `Episode.locked: Boolean!` = `number > FREE_EPISODES && !viewerIsPremium` (the catalog is public, so a signed-out viewer is never premium).
   - For locked episodes, return `videoUrl: null` and an empty `transcript` and `takeaways`. Keep title, summary, duration and thumbnail so the locked rows still render.
   - Mutation `refreshPremium: Premium!`: refetches from RevenueCat for the current user, so the app doesn't wait for the webhook right after a purchase.

## Part C: Lock the media (required before launch)
Videos are served from a public bucket at predictable paths (`mediaUrl()` → `<MEDIA_BASE_URL>/books/<id>/<n>.mp4`), so anyone can fetch Episode 4+ directly and the free tier is only enforced in the UI. Fix it:
- Make the media bucket private and have the backend return short-lived signed URLs (e.g. GCS V4 signed URLs, ~1 hour) from `Episode.videoUrl`, only for episodes the viewer may watch. Thumbnails can stay public.
- This needs a service account / bucket permission change that I (Steve) must make. Write the code behind a flag (`SIGNED_MEDIA=true`), document the exact IAM and bucket steps in backend/README.md, and stop to ask me before changing any bucket or cloud settings.

## Store setup (I'll do these; write them as a checklist in mobile-app/README.md)
App Store Connect: subscription group "mintsy Premium" with monthly and yearly products plus intro free trial, Paid Apps agreement, and sandbox testers. Google Play Console: matching subscriptions and base plans. RevenueCat: project, apps, entitlement `premium` attached to both products, offering `default` with `$rc_monthly` / `$rc_annual`, public SDK keys, a secret API key, and the webhook URL + auth header. Include where each key goes.

## Testing (report results)
- Dev build on device or simulator with sandbox accounts: buy yearly (trial), buy monthly, cancel, restore on a fresh install, expiry (sandbox renewals are accelerated), switch plans.
- Free user: episodes 1–3 play; 4+ locked in the list, the player, deep links, auto-advance and Continue watching; the backend returns no videoUrl or transcript for 4+.
- Premium user: everything unlocked; Settings shows the plan; Plan details opens store management.
- Sign out / sign in as another user: entitlements follow the account, not the device.
- iPhone Duo: paywall and Welcome to Premium two-pane layouts.
- `npx expo lint`, `npx tsc --noEmit` in the app, `pnpm typecheck` in the backend.
