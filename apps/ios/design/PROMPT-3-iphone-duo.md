Work in the existing Expo app at ~/Desktop/Software/mobile-app. Read AGENTS.md first and follow it (SDK 58: use the matching versioned docs before touching any Expo or Expo Router API; install only with `npx expo install`; run `npx expo lint` and `npx tsc --noEmit` before you finish).

## Goal
Make every flow in mintsy work well on iPhone Duo (Apple's foldable: compact outer display, large inner display that opens like a book) without changing anything on regular iPhones. Primary reference: https://expo.dev/blog/supporting-iphone-duo. Read it, plus the SDK 58 docs for every API named below, before writing code; these APIs are new, so don't work from memory.

Design reference: design/README.md, then the iPhone Duo files 14–16 and 20–34. They show the open-display (wide) layout of every screen, plus the tabletop player. The 1080×820 / 820×1080 artboard sizes are illustrative; build responsive layouts driven by `useWindowDimensions` read at render time, never cached. File 21 and the left strip in every Duo file is the iOS system rail: iOS draws it from NativeTabs and the Stack header. Never build it; only leave room for it via safe-area insets.

Do this after design/PROMPT.md and design/PROMPT-2-auth-onboarding-profile.md. Apply the rules to whatever screens exist; Premium screens (17–19, Duo 32–34) apply once Premium is built.

## Ground rules (whole app)
1. Navigation stays native: Expo Router `Stack` and `NativeTabs` only. No custom JS headers or tab bars (they don't move into the rail). Replace any that exist. Header actions (Back, Cancel/Save on Edit profile, Settings gear) belong in the native header so iOS can place them in the rail.
2. Horizontal safe areas: the rail adds an 84pt inset on one edge (left or right; read both, it flips for RTL).
   - `SafeAreaView` / `useSafeAreaInsets` from react-native-safe-area-context with `left` and `right` edges on every screen.
   - Scroll views: `contentInsetAdjustmentBehavior="automatic"`; pad the content container, not the scroll view or root.
   - Absolutely positioned elements (player overlay buttons, pinned bottom CTAs in onboarding and the paywall, cover badges) add insets: `insets.right + 16`, not `16`.
   - Don't add a fixed tab bar height to `insets.bottom`.
   - Full-bleed backgrounds (tinted brand panels, video) may run edge to edge; nothing tappable under the rail.
3. Orientation: app.config.ts has `orientation: 'portrait'`, but on iOS 27 locks are only preferences and the open display shows the app in landscape. Every screen must lay out correctly wide. Don't rely on `expo-screen-orientation` locks.
4. Widen, don't redesign: compact width (folded, regular iPhones) = current phone layouts. Regular width (open) = same features, copy and state, laid out in two panes. Choose by window width (e.g. ≥ 700pt = wide), never by device model. Keep state (form input, selections, playback position, expanded row) when the layout switches mid-fold.
5. The shared wide pattern: a left pane about 456pt wide (it ends near the fold on the open display) and a right pane taking the rest, each scrolling independently. Build one reusable `TwoPane` layout component (flex row when wide, single column when compact) and use it everywhere below. Use `ArrangementView` (`@expo/ui/swift-ui`, `arrangementViewStyle('split')`, iOS 27.1+) for the player; for the rest a plain width-driven flex row is fine. `SplitView` from Expo Router is experimental in SDK 58; only use it if it fits cleanly.

## Screen by screen (wide layouts)
- Browse (file 20): single scrolling column that widens. Header row: wordmark, wide search field, avatar. Featured card goes side by side (cover panel left, text and buttons right). Rows show more covers. In landscape on the open display, try `preferredPlacement="sidebar"` on `NativeTabs`; fall back to 'automatic' if it looks wrong.
- Series page (file 16; free tier file 32): left pane = cover, title, meta, Resume/Unlock button, actions, progress, description. Right pane = Episodes header with chapter-range pills and the episode list. Free tier: episodes 1–3 marked Free, 4+ show a lock and "Unlock with Premium" leading to the paywall.
- Player (files 14 and 15):
  - `<StatusBar verticalBarBehaviorIOS="disabled" />` (expo-status-bar) on this screen, constant for the screen.
  - Wide/open (14): ArrangementView split. Primary: 16:9 video, title, transport row, Up next. Secondary: Transcript / Key takeaways tabs, scrolling independently. On iOS < 27.1 ArrangementView renders children without a container; make sure that fallback is the normal phone layout.
  - Tabletop (15): `expo-hinge` `useHinge()`; when `partiallyOpen` with a horizontal fold, video fills the top half; scrubber, large transport controls (88pt play) and a big "Now" transcript card fill the bottom half. Get the fold frame from `react-native-reserved-regions` (`useReservedRegions()`, the `division` region) instead of assuming 50%, and keep ~24pt clear on each side of it with nothing tappable.
- Auth (files 22–24): left pane is a brand panel (Welcome: fanned covers + logo; Create account / Sign in: the screen title, subtitle and a short supporting block). Right pane holds the buttons or the form, max ~420pt wide, vertically centered. Back lives in the native header (rail).
- Onboarding (files 25–28): left pane = vertical 4-step progress list (done steps checked, current highlighted) + "Step N of 4", title, subtitle. Right pane = the step's choices (interest chips; 2×2 daily-time cards with the live estimate; reminder preview + time options; three first-series cards) with Skip / secondary action and the primary button bottom-right. Replace the phone's horizontal progress bar with the vertical list when wide.
- Profile (file 29): left pane = header + settings gear (native header), avatar/name/Edit, the three stat tiles, This week chart. Right pane = In progress, Your interests, library list.
- Edit profile (file 30): Cancel / Save are native header items (they move into the rail). Left pane = avatar + Change photo, Name, Email. Right pane = daily-goal segmented control and interest chips.
- Settings (file 31): two columns of grouped sections. Left: Account (incl. Subscription), Appearance, Support. Right: Playback, Notifications, then Sign out, Delete account and the version.
- Paywall (file 33): left pane = close, "3 free episodes watched" context, headline, benefits. Right pane = Restore purchases, plan cards, trial button, auto-renew fine print, Terms/Privacy, "Not now". Keep all App Store-required text visible without scrolling on the open display.
- Welcome to Premium (file 34): left = brand panel with the icon and "Every episode is unlocked"; right = Up next card, Play Episode 4, Go to Home.
- Sheets and popovers on a half-open device should land on one side of the fold.

## Don'ts
- Don't detect iPhone Duo via `useVerticalBarEdgeIOS()` (null on the open display in portrait too).
- Don't do manual fold math when ArrangementView or reserved regions cover it.
- Don't change regular-iPhone layouts.

## Testing (report results)
Xcode 27.1 + Device Hub's iPhone Duo simulator (EAS: `sdk-58` or `latest` image). For every screen in every flow (auth, onboarding, browse, series, player, profile, edit, settings, paywall): folded, open portrait, open landscape, partially open, rotated, Split View (left window ~469pt), RTL, and folding/unfolding mid-task (typing in a form, mid-onboarding, playing a video) to confirm state survives. Then a regular iPhone to confirm nothing changed. Lint and typecheck pass.
