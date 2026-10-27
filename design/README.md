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
- `{{accent}}` = the brand accent, default `#F5B83D`.
- Fonts: Space Grotesk (500/700) for headings and the wordmark; Inter (400/500/600) for body text.
- Map hex colors to the app's theme tokens in `src/global.css`; don't hard-code them in components.

## Prompts
- `PROMPT.md`: browse, book series and player (screens 1–3).
- `PROMPT-2-auth-onboarding-profile.md`: auth, onboarding and profile (screens 4–13).
