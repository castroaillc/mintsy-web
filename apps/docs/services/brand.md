# Brand (`mintsy-web/packages/brand`)

`@mintsy/brand` is everything about how mintsy looks, in one package, used by web, admin, studio and (through generated files) the iOS app. The backend's emails can use it too if they want it.

| What | Where |
|---|---|
| Color theme: **Ink & Coral**, with dark and light | `css/`, `dist/` |
| CSS for the web: shadcn/ui variables, Tailwind v4 utilities, theme switching | `css/web.css`, `css/tailwind.css` |
| CSS for NativeWind 5 and gluestack, made for the retired Expo app. Nothing uses it now | `css/native/` |
| Tokens in JS/TS: colors, fonts, radii, brand facts, logo outlines, helpers | `import … from '@mintsy/brand'` |
| Brand fonts (Space Grotesk, Inter) with their licenses | `fonts/`, `css/fonts.css` |
| Logos (wordmark `mintsy.` and mark `m.`) as SVG | `assets/logo/` |
| App icons, splash, favicons for each theme | `assets/icons/<theme>/` |

Everything is generated from **`src/tokens.mjs`**. Change a color there, run `npm run build`, then reinstall in each app.

## Install

In `mintsy-web`, add it to an app's `package.json` and run `pnpm install` in that app's workspace. `apps/studio` is its own pnpm workspace, so install there separately, and links it from `../../packages/brand`.

```jsonc
"@mintsy/brand": "workspace:*"
```

`dist/` and `css/` are committed, so nothing needs to build on install. After changing `src/tokens.mjs`, run `npm run build` in the package and commit the output.

## Theme

| Theme | Brand color (dark / light) | Backdrops instead of | Notes |
|---|---|---|---|
| `ink-coral` (default) | `#FF6B57` / `#C4321F` | indigo and plum | Violet-tinted ink neutrals; success is sky blue |

Light-mode brand colors pass 4.5:1 with white text.

**One naming difference, on purpose:** in the `css/native/` variables `primary` is the neutral strong color (white buttons in dark mode, like gluestack's defaults). On the web, shadcn's `--primary` is the **brand** color, and that neutral is available as `--neutral-strong`.

## Admin (Next.js + shadcn/ui + Tailwind v4)

In `src/app/globals.css`, replace the hand-written `:root` color block and the color lines of `@theme inline` with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@mintsy/brand/css/fonts.css";
@import "@mintsy/brand/css/tailwind.css";   /* includes web.css */

@custom-variant dark (&:is(.dark *));
```

Choose the theme on `<html>` in `src/app/layout.tsx` (no attribute = Ink & Coral, dark):

```tsx
<html lang="en" data-theme="ink-coral">
```

You get every shadcn variable (`--background`, `--primary`, `--sidebar-*`, `--chart-1..5`…) plus mintsy's: `bg-brand`, `text-faint`, `bg-surface-raised`, `border-border-strong`, `text-success`, `bg-tint-1..4`, `text-collage-pink`, `font-display`.

## Plain CSS (no Tailwind)

For a web page without Tailwind, import the fonts and the web theme, and use the variables directly:

```css
@import "@mintsy/brand/css/fonts.css";
@import "@mintsy/brand/css/web.css";
```

Load Oswald from Google Fonts if you need it, and set `<html data-theme="ink-coral">`. Logos are in `assets/logo/`, and `assets/icons/ink-coral/` has `favicon.png` and `apple-touch-icon.png`. `theme-color` is `themes['ink-coral'].dark.background`.

## iOS app

The [iOS app](ios.md) doesn't import the package at runtime. `apps/ios/scripts/generate-brand.mjs` reads `src/tokens.mjs` (themes, fonts, radii, cover ink) and `assets/logo/`, and writes:

- `Mintsy/Resources/Brand.xcassets`: color sets (light and dark), the wordmark and mark as SVG, and an app icon per variant.
- `Mintsy/Brand/Palette.generated.swift` and `BrandFontName.generated.swift`: colors, episode tints, cover ink, radii, and the PostScript names read from the bundled fonts.

`project.yml` bundles the TTFs straight from `fonts/`. The per-variant app icons come from `apps/ios/design/icons/`, not from `assets/icons/`, and the script flags the production icon when it differs from `assets/icons/<theme>/icon.png`.

After changing the package, run `node scripts/generate-brand.mjs` in `apps/ios` and commit the output. `--check` fails when the generated files are out of date.

## Backend emails and studio videos

The same JS works anywhere Node runs: `getTheme('ink-coral', 'light').brand` for email buttons, `collage` for the episode illustration palette (`#E8457A` pink, `#4FDDB0` mint…), `fonts.condensed` for episode labels, `brand.url` and `brand.supportEmail` for footers.

## Exports

| Export | |
|---|---|
| `brand` | name, wordmark, tagline, description, domain, url, supportEmail, appScheme |
| `themes`, `defaultTheme`, `defaultMode` | `themes[name].dark / .light` (all semantic colors), `.tints`, `.iconBackground`, `.splashBackground`, `.label` |
| `getTheme(name?, mode?)` | colors for a theme and mode (defaults: `ink-coral`, `dark`) |
| `tintFor(i, name?)` | backdrop tint for the i-th card, wrapping around |
| `coverInkFor(hex)` | readable text color on a cover color |
| `collage` | episode illustration palette |
| `fonts` | families, weights, CSS stacks, and the expo-font names the retired Expo app used |
| `logo`, `logoPaths` | wordmark rules; vector outlines of `mintsy.` and `m.` |
| `radius`, `spacing` | shared radii and layout widths |
| `hexToRgb`, `rgba` | small color helpers |
| `@mintsy/brand/tokens.json` | all of the above as JSON |

## Changing the brand

1. Edit `src/tokens.mjs`. To add a theme, copy a block in `themes` and give it a new name; every output picks it up.
2. `npm run build` regenerates `dist/` and `css/`.
3. `npm run icons` re-renders the app icons (needs Playwright). `npm run logos` regenerates the logo outlines (needs Python with fontTools).
4. Commit, then reinstall in each app (`pnpm install`, or bump the pinned commit for git installs), and rerun `generate-brand.mjs` for iOS.

Existing videos keep the old look until they're re-rendered.

## Fonts

Fonts are under the SIL Open Font License (`fonts/licenses/`). Oswald, used for episode labels, isn't bundled: load it from Google Fonts where needed.
