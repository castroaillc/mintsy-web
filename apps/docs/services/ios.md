# iOS (`mintsy-web/apps/ios`)

The mintsy iPhone app, in Swift and SwiftUI. Screen designs live next to it in `apps/ios/design/*.dc.html`, and the per-variant icons in `apps/ios/design/icons/`.

It replaced the Expo app, which was retired on 2026-11-10 before it had any users. Its code is in git history at commit `75b0adc` (`apps/mobile/`), for checking how a feature behaved there.

Dev builds run in the simulator, and the Preview variant has run on a physical iPhone against the preview API. Nothing is archived, uploaded or released yet.

## Getting started

```sh
cd apps/ios
cp Config/API.xcconfig.example Config/API.xcconfig   # optional: per-variant API URLs
xcodegen generate                                   # Mintsy.xcodeproj is generated and gitignored
xcodebuild -project Mintsy.xcodeproj -scheme "Mintsy Dev" \
  -destination "platform=iOS Simulator,name=iPhone 18 Pro" test
```

Needs Xcode 27.2 and XcodeGen. The **Mintsy Dev** scheme talks to `http://localhost:4000`, so run the [backend](../backend/index.md) locally and sign in with an account on it. `apps/ios/README.md` has the details.

## Stack

| Concern | Choice |
|---|---|
| Project | XcodeGen (`project.yml`). Swift 6 language mode, main-actor default isolation, iOS 18.0 deployment target |
| UI | SwiftUI, `@Observable` stores passed through the environment, `TabView` with the `Tab` API, `NavigationStack` with value destinations |
| Brand | Generated from `packages/brand` by `scripts/generate-brand.mjs`: color sets (light and dark; the app pins dark for now), wordmark and mark SVGs, font PostScript names. The same script makes one app icon set per variant from `design/icons/` (checked for 1024×1024 and no alpha). The TTFs are bundled straight from `packages/brand/fonts`. Categories and `FREE_EPISODES` come from `packages/shared` the same way. `--check` fails when they drift |
| API | `GraphQLClient`: async `URLSession` POST to `/graphql` with the session cookie; throws `APIError.graphQL` with the first error's `extensions.code` |
| Auth | Better Auth REST (`/api/auth/sign-in/email`, `/get-session`, `/sign-out`). Cookies kept by hand in a Keychain cookie jar (`CredentialStore`), not `HTTPCookieStorage` |
| Video | AVKit (`AVPlayerViewController` without its controls) under the app's own controls; `PlaybackEngine` wraps `AVPlayer` |
| Tests | Swift Testing unit tests (`MintsyTests`), and an XCUITest smoke run (`MintsyUITests`) that skips unless given credentials |

No third-party Swift packages.

### Deployment target

**iOS 18.0**, confirmed by the user on 2026-11-10. The project rules require `@Observable` models (iOS 17), and the `Tab` API (iOS 18) is what lets the tab bar adapt to iPhone Duo's vertical bar and to sidebars later. Lowering to 17.0 would mean an older tab bar API. (The retired Expo app targeted iOS 16.4.)

## Variants

Team `9496L7QUB2`:

| Scheme | Configuration | Bundle ID | Display name | URL scheme | Icon | Default API |
|---|---|---|---|---|---|---|
| Mintsy Dev | Development | `com.getmintsy.app.dev` | Mintsy Dev | `mintsy-dev` | `icon-dev.png` | `http://localhost:4000` |
| Mintsy Preview | Preview | `com.getmintsy.app.preview` | Mintsy Preview | `mintsy-preview` | `icon-preview.png` | none (set it in `API.xcconfig`) |
| Mintsy | Production | `com.getmintsy.app` | Mintsy | `mintsy` | `icon.png` (the brand icon) | `https://api.getmintsy.com` |

`Config/<Variant>.xcconfig` sets the identity and the icon set (`ASSETCATALOG_COMPILER_APPICON_NAME`: `AppIcon-Dev`, `AppIcon-Preview`, `AppIcon`); the gitignored `Config/API.xcconfig` (from `API.xcconfig.example`) sets `MINTSY_API_URL_<VARIANT>` and optionally `MINTSY_HLS_ENABLED`. The values reach the app through Info.plist keys (`MintsyAPIURL`, `MintsyURLScheme`, `MintsyVariant`, `MintsyHLSEnabled`). A variant without an API URL shows "This build isn't configured" instead of starting.

## Talking to the backend

What the app sends:

- **Auth.** Every `/api/auth/*` request carries `Origin: <scheme>://` (`mintsy-dev://` and so on). Better Auth checks the origin of any POST that carries a cookie (sign-out answers 403 `MISSING_OR_NULL_ORIGIN` without one), and the three schemes are already in `trustedOrigins` (`apps/backend/src/auth.ts`). Sign-in sends no cookie. Every `Set-Cookie` the API answers with (sign-in, a refreshed session, sign-out's `Max-Age=0`) updates the Keychain jar.
- **Session on launch.** No session cookie stored: signed out at once. A cookie and a cached user: signed in at once, then `/get-session` confirms it (a `null` answer signs out; offline keeps the cached user). A cookie with no cached user waits for the API, and shows "Couldn't load mintsy" with Try again if it can't be reached.
- **GraphQL.** `Cookie: better-auth.session_token=…` (or the `__Secure-` name on https) on every request. The catalog query asks for `hlsUrl` only when HLS is on; `episodeVoices` is a separate request per episode.

## Milestone 1: what's built

- **Sign in** with email and password for an existing account. Sign out from Profile.
- **Tabs**: Home, Search, My List, Profile. Search and My List say "Not built yet"; Profile shows the account, Sign out, the variant and the API URL.
- **Home** (design 1): wordmark, profile button, a search field that filters by title, author and category, category chips, the featured series (side by side in a regular-width window), "More in …" and "Recently added" rows, loading, error and empty states, pull to refresh.
- **Book** (design 2): tinted hero with the cover (rendered image or generated tile), facts, play button, description, Episodes / Transcripts / About tabs, chapter range pills past 10 episodes, expandable episode rows with a transcript preview, "Read transcript" jumping to the episode's transcript, share.
- **Player** (design 3), full screen over the tabs:
  - AVKit playback of the HLS playlist (when enabled) or the MP4, with one fallback from HLS to MP4.
  - Controls over the video that fade after 3.5 s while playing and stay up while paused, scrubbing or with VoiceOver on: close, captions, full screen, −10 s, play/pause, +10 s, scrubber.
  - **Narrators**: `episodeVoices` is fetched per episode. A viewer with no preferred narrator starts on the catalog's source at once; one with a preference waits up to 1.5 s for the answer and starts on that voice. The Narrator menu shows when more than one voice can play; switching lands on the start of the current sentence in the new voice (`VoiceLogic.switchPosition`, ported from the Expo app's `src/lib/voices.ts` with its test cases) and becomes the preference. Stale URLs (over 5 minutes) are refetched before switching, and a failed source retries once a minute with fresh URLs.
  - **Timed captions** from the selected voice's phrases, with a short lead-in and linger, lifted above the transport while the controls show. Episodes without voices show the transcript line along the top instead, as before.
  - Episode label, title, series strip, previous / speed / narrator / next, Transcript (following along, tap to seek, "Back to current" after scrolling) and Key takeaways tabs, Up next, autoplay of the next episode.
- **Locked episodes** (free tier, episode 4 on) never play. Opening one says it's part of Premium and that subscribing isn't in the native app yet.

## Feature backlog

What the retired Expo app had that this app doesn't yet. The Expo paths are in git at `75b0adc` under `apps/mobile/`.

- **Welcome and onboarding**: the welcome screen, interests, daily time, reminders, first series (`src/app/onboarding/`).
- **Sign-up**, **forgot / reset password**, the `reset-password` and `email-changed` deep links (`+native-intent.tsx`).
- **Sign in with Apple and Google** (native ID tokens, `lib/social-auth.ts`; the app needs the Sign in with Apple entitlement and per-variant Google URL schemes).
- **Progress**: resume position, watched state, Continue watching on Home, "x of y watched" and Resume on the book page, saving position (`setProgress`), Series complete.
- **Search** (books and transcript matches) and **category "See all"**.
- **My List** (saving books and episodes, `setSaved`).
- **Profile and settings**: edit profile, change email, change password, delete account, plan details, finished series, settings (autoplay, captions by default, default speed, narrator, theme, notifications), support and legal links.
- **Paywall and Premium** (RevenueCat purchases, restore, Premium welcome, end-of-free upsell, Premium-only downloads and full transcript).
- **Push notifications** (token registration with the backend, daily reminders).
- **Downloads** (offline episodes with their voice, excluded from backup).
- **Offline catalog cache** and the offline notice on Home.
- **Light mode** and the theme setting (the color sets already carry light values).
- **Player extras**: landscape and the phone-sideways full screen (phones are portrait-only for now), Picture in Picture, Now Playing / lock screen controls.
- **Wide layouts and iPhone Duo**: the two-pane book page, the split player, tabletop mode, the vertical bar and fold handling. Layouts already choose by size class, not device, and use system tab and toolbar APIs so they can adapt.
- **Observe / Insights** equivalents (performance and crash data), if wanted; any new data collection needs the privacy policy updated.
- **Release**: signing, App Store Connect, TestFlight, versioning.
