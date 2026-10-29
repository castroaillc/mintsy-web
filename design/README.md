# mintsy design reference

Source files of the approved mintsy mockups (phone screens, 390pt wide). They are the visual
source of truth for layout, spacing, sizes, colors, type, copy and interactions.

| File | Screen | Canvas name (used in links inside the files) | Route to build |
|---|---|---|---|
| `0-logo.dc.html` | Logo mark (reference only) | Logo | — (icons already in assets/images) |
| `1-browse.dc.html` | Browse / Home | Main | `(app)/(home)/index.tsx` |
| `2-book-series.dc.html` | Book series & chapters | Book | `(app)/(home)/book/[id].tsx` |
| `3-player.dc.html` | Episode player & synced transcript | Player | `(app)/player/[episodeId].tsx` |
| `4-auth-welcome.dc.html` | Welcome | AuthWelcome | `(auth)/welcome.tsx` |
| `5-auth-sign-up.dc.html` | Create account | AuthSignUp | `(auth)/sign-up.tsx` |
| `6-auth-sign-in.dc.html` | Sign in | AuthSignIn | `(auth)/sign-in.tsx` |
| `7-onboarding-interests.dc.html` | Onboarding 1 · Interests | OnbInterests | `(onboarding)/interests.tsx` |
| `8-onboarding-daily-time.dc.html` | Onboarding 2 · Daily time | OnbTime | `(onboarding)/daily-time.tsx` |
| `9-onboarding-reminders.dc.html` | Onboarding 3 · Reminders | OnbReminders | `(onboarding)/reminders.tsx` |
| `10-onboarding-first-series.dc.html` | Onboarding 4 · First series | OnbFirstBook | `(onboarding)/first-series.tsx` |
| `11-profile.dc.html` | Profile (tab) | Profile | `(app)/(profile)/index.tsx` |
| `12-profile-edit.dc.html` | Edit profile | ProfileEdit | `(app)/(profile)/edit.tsx` |
| `13-settings.dc.html` | Settings | ProfileSettings | `(app)/(profile)/settings.tsx` |
| `14-duo-player-open.dc.html` | iPhone Duo · Player, open display (video + transcript side by side) | DuoPlayerOpen | Wide layout of the player route |
| `15-duo-player-tabletop.dc.html` | iPhone Duo · Player, half-folded on a table | DuoPlayerTabletop | Tabletop layout of the player route |
| `16-duo-series-open.dc.html` | iPhone Duo · Series page, open display | DuoSeriesOpen | Wide layout of the book route |

| `17-premium-series-free.dc.html` | Series page, free tier (episodes 4+ locked) | BookFree (= Book with plan=free) | State of `book/[id]` for free users |
| `18-premium-paywall.dc.html` | Paywall | Premium | Paywall modal |
| `19-premium-welcome.dc.html` | Welcome to Premium | PremiumSuccess | After purchase |
| `20-duo-browse-open.dc.html` | iPhone Duo · Browse, open | DuoBrowseOpen | Wide layout of Home |
| `21-duo-system-rail.dc.html` | iPhone Duo · the iOS system rail (reference only, never build) | DuoRail | — |
| `22-duo-auth-welcome.dc.html` | iPhone Duo · Welcome | DuoAuthWelcome | Wide layout of welcome |
| `23-duo-auth-sign-up.dc.html` | iPhone Duo · Create account | DuoAuthSignUp | Wide layout of sign-up |
| `24-duo-auth-sign-in.dc.html` | iPhone Duo · Sign in | DuoAuthSignIn | Wide layout of sign-in |
| `25-duo-onboarding-interests.dc.html` | iPhone Duo · Onboarding 1 | DuoOnbInterests | Wide layout |
| `26-duo-onboarding-daily-time.dc.html` | iPhone Duo · Onboarding 2 | DuoOnbTime | Wide layout |
| `27-duo-onboarding-reminders.dc.html` | iPhone Duo · Onboarding 3 | DuoOnbReminders | Wide layout |
| `28-duo-onboarding-first-series.dc.html` | iPhone Duo · Onboarding 4 | DuoOnbFirstBook | Wide layout |
| `29-duo-profile.dc.html` | iPhone Duo · Profile | DuoProfile | Wide layout |
| `30-duo-profile-edit.dc.html` | iPhone Duo · Edit profile | DuoProfileEdit | Wide layout |
| `31-duo-settings.dc.html` | iPhone Duo · Settings | DuoSettings | Wide layout |
| `32-duo-series-free.dc.html` | iPhone Duo · Series page, free tier | DuoBookFree (= DuoSeriesOpen with plan=free) | Wide layout |
| `33-duo-paywall.dc.html` | iPhone Duo · Paywall | DuoPaywall | Wide layout |
| `34-duo-premium-welcome.dc.html` | iPhone Duo · Welcome to Premium | DuoPremiumSuccess | Wide layout |

| `35-search-results.dc.html` | Search results (Books / Episodes filter, transcript matches) | SearchResults | Search tab |
| `36-category-all.dc.html` | Category “See all” grid | CategoryAll | e.g. `(app)/(home)/category/[id].tsx` |
| `37-my-list.dc.html` | My List: Saved · In progress · Finished (empty state via tweak) | Library | My List tab |
| `38-downloads.dc.html` | Downloads (storage, in-progress, grouped; offline banner via tweak) | Downloads | `(app)/profile/downloads.tsx` |
| `39-home-first-run.dc.html` | Home for a new user (nothing watched yet) | HomeFirstRun | State of Home |
| `40-tab-bar.dc.html` | Tab bar reference: Home · Search · My List · Profile (use NativeTabs, never build) | TabBar | — |
| `41-up-next.dc.html` | Episode ends: Up next countdown + recap | PlayerUpNext | State of the player |
| `42-episode3-upsell.dc.html` | Episode 3 ends for a free user: Premium upsell | PlayerUpsell | State of the player |
| `43-series-complete.dc.html` | Series complete | SeriesComplete | Modal after the last episode |
| `44-transcript-reader.dc.html` | Transcript reader | TranscriptReader | e.g. `transcript/[episodeId].tsx` |
| `45-forgot-password.dc.html` | Forgot password: request link | ForgotPassword | `(auth)/forgot-password.tsx` |
| `46-check-email.dc.html` | Forgot password: check your email | CheckEmail | Step 2 of the same flow |
| `47-reset-password.dc.html` | Forgot password: set new password (opened from the email link) | ResetPassword | `(auth)/reset-password.tsx` (deep link) |
| `48-change-password.dc.html` | Change password (from Settings) | ChangePassword | `(app)/profile/change-password.tsx` |
| `49-delete-account.dc.html` | Delete account confirmation sheet | DeleteAccount | Sheet over Settings |
| `50-plan-details.dc.html` | Plan details (trial / active / cancelled via tweak) | PlanDetails | `(app)/profile/subscription.tsx` |
| `51-states.dc.html` | Loading, empty, offline and error states | States | Patterns for every screen |
| `52-duo-search.dc.html` | iPhone Duo · wide layout of SearchResults | DuoSearch | Wide layout |
| `53-duo-category-all.dc.html` | iPhone Duo · wide layout of CategoryAll | DuoCategory | Wide layout |
| `54-duo-my-list.dc.html` | iPhone Duo · wide layout of Library | DuoLibrary | Wide layout |
| `55-duo-downloads.dc.html` | iPhone Duo · wide layout of Downloads | DuoDownloads | Wide layout |
| `56-duo-home-first-run.dc.html` | iPhone Duo · wide layout of HomeFirstRun | DuoHomeFirstRun | Wide layout |
| `57-duo-up-next.dc.html` | iPhone Duo · wide layout of PlayerUpNext | DuoUpNext | Wide layout |
| `58-duo-episode3-upsell.dc.html` | iPhone Duo · wide layout of PlayerUpsell | DuoUpsell | Wide layout |
| `59-duo-series-complete.dc.html` | iPhone Duo · wide layout of SeriesComplete | DuoSeriesComplete | Wide layout |
| `60-duo-transcript-reader.dc.html` | iPhone Duo · wide layout of TranscriptReader | DuoTranscript | Wide layout |
| `61-duo-forgot-password.dc.html` | iPhone Duo · wide layout of ForgotPassword | DuoForgotPassword | Wide layout |
| `62-duo-check-email.dc.html` | iPhone Duo · wide layout of CheckEmail | DuoCheckEmail | Wide layout |
| `63-duo-reset-password.dc.html` | iPhone Duo · wide layout of ResetPassword | DuoResetPassword | Wide layout |
| `64-duo-change-password.dc.html` | iPhone Duo · wide layout of ChangePassword | DuoChangePassword | Wide layout |
| `65-duo-delete-account.dc.html` | iPhone Duo · wide layout of DeleteAccount | DuoDeleteAccount | Wide layout |
| `66-duo-plan-details.dc.html` | iPhone Duo · wide layout of PlanDetails | DuoPlanDetails | Wide layout |
| `67-user-journeys.dc.html` | User journey map (12 journeys, what's designed, what's open) | Journeys | — |
| `68-toasts.dc.html` | Toast component: interactive Saved/Undo demo plus 6 variants and timing rules | ToastDemo | Shared component |
| `69-profile-premium.dc.html` | Profile as a Premium member (PREMIUM badge → Plan details). File 11 is the free version with the upgrade card | ProfilePremium | `/(tabs)/profile` |
| `70-series-transcripts-tab.dc.html` | Series page, Transcripts tab (locked rows past Episode 3 for free users) | BookTranscripts | `/book/[id]?tab=transcripts` |
| `71-series-about-tab.dc.html` | Series page, About tab (book, what you'll learn, author, details) | BookAbout | `/book/[id]?tab=about` |
| `72-emails.dc.html` | Email templates: reset password, confirm new email, trial ending | Emails | Backend email sender |
| `73-notifications.dc.html` | Push notifications: copy, timing, where each one lands, frequency rules | Notifications | expo-notifications + backend |
| `74-landing-page.dc.html` | Marketing landing page (fluid, desktop to phone) with live iPhone Duo and iPhone mockups | Landing | Website, not the app |
| `75-app-store-iphone.dc.html` | App Store screenshot template, 6 iPhone shots | StoreShot | Marketing only |
| `76-app-store-iphone-duo.dc.html` | App Store screenshot template, 5 iPhone Duo inner-display shots | DuoShot | Marketing only |

Files 14–16, 20–34 and 52–66 are not new routes: they are the wide and tabletop layouts of existing screens. The
1080×820 / 820×1080 sizes are illustrative, not Apple's exact iPhone Duo dimensions. The left strip in
the Duo files (file 21) is the iOS system rail, drawn by iOS from NativeTabs and the Stack header; never build it by hand.

Links inside the files use the canvas names (e.g. `href="OnbTime.dc.html"`); use the table to map
them to routes. Suggested route paths are a starting point; follow Expo Router conventions.

## How to read them
- They are HTML mockups in a design-tool format, **not code to import or run**. Do not copy the
  `<x-dc>`, `<sc-for>`, `<sc-if>`, `support.js` or `DCLogic` pieces into the app.
- Markup between `<x-dc>` and `</x-dc>` is the layout. Inline `style="…"` values are the exact
  measurements (px = pt in React Native) and colors.
- `<sc-for list="{{x}}">` = a list rendered from `x`; `<sc-if value="{{y}}">` = shown when `y` is true.
- The `<script type="text/x-dc">` block at the bottom of each file holds the mock data and the
  interaction logic (selection states, toggles, estimates). Reuse that data and behavior.
- `<dc-import name="X">` embeds the screen whose canvas name is X (see the table), with any extra attributes as its settings, e.g. `plan="free"`.
- `{{accent}}` = the brand accent, default `#F5B83D`.
- Fonts: Space Grotesk (500/700) for headings and the wordmark; Inter (400/500/600) for body text.
- Map hex colors to the app's theme tokens in `src/global.css`; don't hard-code them in components.

## Prompts
- `PROMPT.md`: browse, book series and player (screens 1–3).
- `PROMPT-2-auth-onboarding-profile.md`: auth, onboarding and profile (screens 4–13).
- `PROMPT-3-iphone-duo.md`: iPhone Duo support across the app (screens 14–16 and 20–34).
- `PROMPT-5-library-watching-account.md`: everything in 35–66, plus link fixes in 1, 2, 3, 6, 11, 13.
- `PROMPT-4-premium.md`: free tier, paywall, purchases (RevenueCat), backend entitlements and locked media (screens 17–19 and 32–34).
- `PROMPT-6-finishing-touches.md`: toasts, Premium badge and upgrade card, Transcripts/About tabs, emails, push notifications (screens 2, 11, 67–73).

## Marketing
- `app-store/` holds ready-to-upload PNGs (RGB, no transparency):
  - `iphone-6.9/` 1320×2868 (6 shots) · `iphone-6.3/` 1206×2622 (6 shots, the required size)
  - `duo-inner/` 2853×2007 landscape (5 shots) · `duo-outer/` 1398×2034 (6 shots)
- `landing-preview-desktop.png` / `landing-preview-mobile.png` are renders of file 74.
- The `.dc-annot` class marks design notes (e.g. "SYSTEM RAIL") that marketing renders hide.
- Placeholders to fill before launch: `[APP ID]`, `[Apple App Store badge]` (use Apple's official badge artwork), `[YEARLY PRICE]`, `[MONTHLY PRICE]`, `[TRIAL LENGTH]`, `[COMPANY NAME]`, `[YEAR]`, `[PRIVACY URL]`, `[TERMS URL]`, `[SUPPORT EMAIL]`, `[PRESS KIT URL]`, and the catalog titles.
- `fonts/` has Space Grotesk and Inter copied from the app's node_modules, used to render these images.
