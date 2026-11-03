Work in the existing Expo app at ~/Desktop/Software/mobile-app (NOT mintsy-ui). Read AGENTS.md first and follow it: check the Expo SDK version in package.json (SDK 58) and use the matching versioned docs before touching any Expo or Expo Router API. Install packages only with `npx expo install`. Run `npx expo lint` and `npx tsc --noEmit` before you finish.

## Design reference: read this first
The approved mockups are in `design/` in this repo. Read `design/README.md`, then all three `.dc.html` files, before writing any code. They are the source of truth for layout, sizes, spacing, colors, type, copy, mock data and interactions. Match them closely. The written spec below summarizes them; where the two differ, follow the design files. They are mockups, not code to import (see the README).

## Task
Build the frontend UI for mintsy, an app that turns books into short video series. Each chapter of a book is one ~5-minute video episode with a transcript, presented like Netflix/Hulu: every show is a book, every episode is a chapter.

FRONTEND UI ONLY: mock data and in-memory state. Do not add backend calls, change GraphQL, or touch auth (src/lib/auth-client.ts, the (auth) routes, Stack.Protected guards), push notifications, or the Settings screen's behavior.

## Use what the app already has
- Routing: Expo Router in src/app. The signed-in area is the (app) group, which uses NativeTabs in src/app/(app)/_layout.tsx with SF Symbols / Material icon names. Keep that pattern.
- UI: gluestack-ui v5 components in src/components/ui (Box, VStack, HStack, Text, Heading, Button, Input, Center) styled with NativeWind className. Use these and SafeAreaView from src/components/safe-area-view instead of raw View/Text wherever reasonable.
- Theme: design tokens are CSS variables in src/global.css (light + dark) exposed as Tailwind colors (bg-background, bg-card, text-foreground, text-muted-foreground, border-border…). Light/dark/system mode is chosen in Settings via src/lib/theme-mode.tsx. Do NOT hard-code hex colors in components.
- Already installed and preferred: expo-image, expo-symbols (icons), react-native-svg, react-native-reanimated, @legendapp/motion, expo-font.
- Put components in src/components/mintsy/, mock data in src/data/, and hooks/context in src/lib or src/hooks. Only route files go in src/app.

## Theme additions (src/global.css)
Add mintsy tokens to both the light and dark blocks and register them in `@theme inline`:
- --brand (accent): gold 245 184 61 in dark; a darker gold that passes 4.5:1 contrast on white in light. Also --brand-foreground (21 22 27).
- --surface-raised, --tag (chip/tag background), --faint (the faintest text).
- Retune the dark palette toward the design: background #0D0E12, card #15161C, raised #17181F, tag #1B1C24, border #23252E, foreground #F2F2F5, muted-foreground #A3A5B0, faint #8B8D99.
Keep the auth and settings screens looking right in both modes after the change.
Fonts: add Space Grotesk (500, 700) and Inter (400, 500, 600) via @expo-google-fonts, loaded in the root layout before the splash screen hides (hook into the existing isReady logic), and register them as Tailwind font families.

## Routes
- Home tab: turn the Home tab into a nested stack so detail screens push inside the tab, e.g. src/app/(app)/(home)/_layout.tsx (Stack) with index.tsx (Browse) and book/[id].tsx. Verify the right NativeTabs + nested Stack setup in the SDK 58 Expo Router docs.
- Player: player/[episodeId].tsx, presented full screen (modal or fullScreenModal) over the tabs.
- Tabs: Home, Search, My List, Settings. Search and My List can be simple placeholder screens for now. Keep Settings as is.
- Replace the current Home content (the GraphQL `me` debug card) with the Browse screen. The profile button in the header can show the signed-in user's initial from authClient.useSession().

## Mock data (src/data/mock.ts)
Take the books, chapters, summaries, durations, transcript lines and takeaways from the design files' script blocks, and extend them.
Types: Book { id, title, author, category, coverTone, description, episodes } · Episode { id, number, title, summary, durationSec, transcript: { startSec, text }[], takeaways: string[] }.
Progress lives in a ProgressProvider context (in memory): { [episodeId]: { positionSec, completed } }. Episodes 1–3 of The Psychology of Money are watched; episode 4 is 40% in.
Episode labels always read "Episode N of TOTAL". Covers are generated tiles (solid tone + title + author), not images.

## Screen 1: Browse (design/1-browse.dc.html)
Header with the "mintsy" wordmark + brand "." and a 44px profile button · live-filtering search field · category chips (selected = filled) · Featured series card with "Play Episode 1" and "+" · "Continue watching" row (236×133 cards with chapter, play badge, progress bar, "Episode N of TOTAL · X min left"; opens the Player) · horizontal poster rows (124×186 tiles, "N eps" badge, "See all"; open Book).

## Screen 2: Book series & chapters (design/2-book-series.dc.html)
Hero cover on a tinted backdrop with back/share · title, author, tag chips · "Resume Episode N of TOTAL" / "Play Episode 1" brand button · My List / Download / Full transcript grid · "X of TOTAL episodes watched" progress · description · Episodes | Transcripts | About tabs · "Chapters 1–10 / 11–20" range pills (chunks of 10) · episode rows (132×76 thumbnail with number, play icon, duration, progress; status line; title; 2-line summary) that expand inline to a transcript preview + Play/Resume/Watch again + Read transcript. One row expanded at a time. Virtualized list.

## Screen 3: Player (design/3-player.dc.html)
16:9 player area (no real video yet: tinted panel with "CHAPTER N" + title, driven by a simulated clock that respects speed), overlaid with close, captions, fullscreen, ±10s, a large brand play/pause, and a draggable scrubber with times · "Episode N of TOTAL", title, "Book · Author" link · segmented series progress strip · previous / speed (1×→1.25×→1.5×→2×) / Save / Next · Transcript | Key takeaways tabs. The transcript is synced: the active line is highlighted, past lines are muted, it auto-scrolls with a "Following along" indicator, manual scrolling shows a "Back to current" pill, and tapping a line seeks · "Up next" card · auto-advance · progress is written to ProgressProvider so Browse and Book update.

## Quality bar
- Reusable components: CoverTile, ChipRow, SectionRow, ContinueCard, EpisodeRow, ProgressBar, SegmentedProgress, TranscriptList, BrandButton, IconButton
- 44px minimum touch targets and accessibilityLabel on icon-only buttons
- Matches the design files in dark mode (primary target) and stays legible in light mode
- Lint and typecheck pass; runs in the existing dev build (expo-dev-client)
