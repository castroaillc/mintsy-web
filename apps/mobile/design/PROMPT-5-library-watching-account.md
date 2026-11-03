Build the remaining mintsy screens: library, watching moments, account recovery/management, and app-wide states. Work in ~/Desktop/Software/mobile-app (and ~/Desktop/Software/backend only where noted).

Read first:
- mobile-app/AGENTS.md (SDK 58: check the versioned docs before touching any Expo API; install only with `npx expo install`).
- design/README.md, then design files 35–51 (phone) and 52–66 (iPhone Duo wide layouts). Also re-read 1, 2, 3, 6, 11, 13: their links changed (see "Wiring" below). 67 is the journey map: use it to check every path works.
- Explore the existing app before writing code; much is already built. Reuse existing components, theme tokens, the progress context and (if built) `usePremium()` from PROMPT-4. Follow PROMPT-3's iPhone Duo rules (native navigation, left/right insets, width-driven two-pane layout) for every screen here.

Data: use the existing GraphQL catalog and progress where they exist. Where a backend field doesn't exist yet, keep data in a small local store or mock behind a hook, and list each gap in your final report. Don't invent backend endpoints except the ones named below.

## Navigation and wiring
- Tabs (NativeTabs): Home · Search · My List · Profile on every screen (design 40 is a reference only; never build a JS tab bar). Downloads lives inside Profile.
- Home featured card "Play Episode 1" starts playback (it used to open the series page).
- "See all" on each Home row → Category screen. Sign in "Forgot password?" → Forgot password. Series page "Read transcript" / "Full transcript" → Transcript reader. Player Next / Up next / episode end → Up next state. Settings: Subscription → Plan details, Change password → Change password, Delete account → confirmation sheet.

## Discover & library
- Search (35 / 52): live search over titles, authors and categories, plus "Episodes that mention …" matches from transcripts, with the matched word highlighted and the timestamp; tapping an episode match opens the player at that time. Filter chips All / Books / Episodes. Debounce input; show recent searches when empty and the no-results state from design 51. Backend: add a `search(query: String!): SearchResult` GraphQL query (books + episode transcript matches with startSec and a snippet). A simple case-insensitive match over the catalog is fine for now; note a text index as a follow-up.
- Category "See all" (36 / 53): grid of a category's books (3 columns phone, 6 wide) with Popular / Newest / Shortest sort.
- My List (37 / 54): segmented Saved · In progress · Finished; empty state per segment. Wide layout is list-detail (pick on the left, details and actions on the right). Saving: the "+" / My List buttons toggle saved state and show a "Saved to My List · Undo" toast (not designed; keep it small, bottom of screen, 4 s). Persist saved items per user (backend `savedBooks` on the user + `saveBook/unsaveBook` mutations if the backend has user data storage; otherwise local and report it).
- Downloads (38 / 55): Premium-only (free users get the paywall). Use expo-file-system (check SDK 58 docs) to download episode MP4s; show progress and cancel, group by book, total size vs free space, delete, Wi-Fi-only setting, auto-remove watched downloads after 7 days. Offline: detect with expo-network (already installed) and show the offline Home/Downloads states from design 51; downloaded episodes play offline. Downloads must use the signed URLs from PROMPT-4 Part C if that's built.
- First-run Home (39 / 56): when the user has no progress, Home leads with the series chosen in onboarding ("Start Episode 1") and today's goal card, then "Because you picked <interest>" rows, then Popular. Switch to the normal Home after the first episode starts. If onboarding interests were skipped, fall back to popular series.

## Watching moments
- Up next (41 / 57): when an episode ends, show the Up next card with an 8-second countdown (respect Settings › Autoplay), Play now / Cancel, the episode's 3 takeaways, and daily-goal progress. At the last episode, go to Series complete instead.
- Episode 3 upsell (42 / 58): for free users, ending Episode 3 shows this instead of Up next; "Continue with Premium" opens the paywall, which on success returns to Episode 4. Prices come from RevenueCat (PROMPT-4); skip this screen if Premium isn't built yet.
- Series complete (43 / 59): stats (episodes, time, days), "The book in 5 ideas" (a book-level `keyIdeas` field; add it to the catalog if missing, else take the first takeaway of the most-watched episodes and report it), 1–5 star rating (store it), What to watch next, Share (native share sheet), Back to Home. Marks the book Finished.
- Transcript reader (44 / 60): full chapter transcript as paragraphs with timestamps, text size A−/A+ (persist), search within the transcript, tap a paragraph → "Play from <time>", key takeaways, and a "Watch instead · Resume at <time>" bar. Premium-only beyond the free episodes.

## Account & subscription
- Forgot password (45–47 / 61–63): request link → check your email (resend with a 30 s cooldown, open the mail app) → set new password from the email link (deep link into the app with the token; scheme is in app.config.ts) → signed in. Use Better Auth's built-in reset-password flow; check its docs for the installed version (1.7.x) and wire the backend email sender. If no email provider is configured on the backend, stop and ask me which one to use before adding one.
- Change password (48 / 64): current, new, confirm, "Sign out of other devices" (default on). Use Better Auth's change-password API.
- Delete account (49 / 65): confirmation sheet (centered dialog in the right pane on the open Duo display), "I understand" checkbox enables the red button, and a warning that deleting doesn't cancel Premium, linking to Plan details. App Store rules require in-app account deletion; implement it with Better Auth's delete-user support plus backend cleanup of the user's progress, saved items, push tokens and entitlement records. Sign out and return to Welcome afterwards.
- Plan details (50 / 66): from `usePremium()`: plan, price, trial end / renewal / end date, status badge (Free trial / Active / Ends soon), Manage or Resubscribe in the App Store (RevenueCat management URL), Restore purchases. Free users see the paywall instead.

## States (51)
Apply across the app: skeletons while loading (respect Reduce Motion), empty states with a next step, the offline banner + downloads fallback, and error screens with "Try again" and a short error reference. Make these shared components.

## Done when
- Every journey on design 67 works end to end on a dev build (phone and the iPhone Duo simulator), and the report lists anything stubbed or mocked.
- No JS tab bars or headers; 44 pt touch targets; labels on inputs; accessibility roles on toggles, radios and tabs.
- `npx expo lint`, `npx tsc --noEmit` (app) and `pnpm typecheck` (backend) pass.
