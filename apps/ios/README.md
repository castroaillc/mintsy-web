# mintsy for iPhone

The mintsy iPhone app, in Swift and SwiftUI. What's built and what's left:
[`apps/docs/services/ios.md`](../docs/services/ios.md). Screen designs are in `design/*.dc.html`.

It replaced an Expo app that was retired on 2026-11-10. That code is in git history at commit `75b0adc`
(`apps/mobile/`); comments here that cite an Expo source file (`src/lib/voices.ts` and so on) mean that tree.

## Requirements

- Xcode 27.2 (Swift 6.4), iOS 18.0 or later
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- Node 24, only to regenerate the brand resources

## Getting started

```sh
cd apps/ios
cp Config/API.xcconfig.example Config/API.xcconfig   # optional: per-variant API URLs
xcodegen generate                                   # writes Mintsy.xcodeproj (gitignored)
open Mintsy.xcodeproj
```

Run the **Mintsy Dev** scheme on an iPhone simulator. It talks to `http://localhost:4000` by default, so start the
backend first (`apps/backend/README.md`) and sign in with an account on that backend.

From the command line:

```sh
xcodebuild -project Mintsy.xcodeproj -scheme "Mintsy Dev" \
  -destination "platform=iOS Simulator,name=iPhone 18 Pro" build
xcodebuild -project Mintsy.xcodeproj -scheme "Mintsy Dev" \
  -destination "platform=iOS Simulator,name=iPhone 18 Pro" test
```

## Variants

| Scheme | Configuration | Bundle ID | Name | URL scheme |
|---|---|---|---|---|
| Mintsy Dev | Development | `com.getmintsy.app.dev` | Mintsy Dev | `mintsy-dev` |
| Mintsy Preview | Preview | `com.getmintsy.app.preview` | Mintsy Preview | `mintsy-preview` |
| Mintsy | Production | `com.getmintsy.app` | Mintsy | `mintsy` |

Identity lives in `Config/<Variant>.xcconfig`. API URLs come from `Config/API.xcconfig` (gitignored; the defaults
are `http://localhost:4000` for Dev and `https://api.getmintsy.com` for Production, and Preview has none until you set
one). `MINTSY_HLS_ENABLED = YES` streams HLS when the API offers it. Nothing here signs for a device or archives.

Each variant has its own home-screen icon: `design/icons/icon-dev.png`, `icon-preview.png` and `icon.png` (the brand
icon). The brand script turns them into the `AppIcon-Dev`, `AppIcon-Preview` and `AppIcon` sets, and each xcconfig
picks one with `ASSETCATALOG_COMPILER_APPICON_NAME`. They must be 1024×1024 with no alpha; the script fails otherwise.

## Brand

Colors, fonts and logo come from `packages/brand` (and the category list from `packages/shared`). After changing
either package, run:

```sh
node scripts/generate-brand.mjs          # rewrites the generated files
node scripts/generate-brand.mjs --check  # fails if they're out of date
```

It writes `Mintsy/Resources/Brand.xcassets` (color sets, wordmark, mark, the three app icons from `design/icons`) and
the `*.generated.swift` files. `--check` also fails when `design/icons/icon.png` no longer matches the brand icon in
`packages/brand`. The fonts are bundled straight from `packages/brand/fonts` by `project.yml`. Don't edit generated files.

## Layout

```
project.yml            XcodeGen spec (targets, configurations, Info.plist keys)
Config/                xcconfig per variant, API.xcconfig.example
scripts/               generate-brand.mjs
design/                screen designs (*.dc.html), per-variant icons (icons/), App Store art
Mintsy/App/            entry point, configuration, root and tab views
Mintsy/Auth/           Better Auth client, Keychain cookie jar, session store, sign-in
Mintsy/Networking/     GraphQL client and errors
Mintsy/Catalog/        models, queries, catalog store
Mintsy/Home/ Book/     screens
Mintsy/Player/         AVKit playback, narrators and timed captions
Mintsy/Placeholders/   tabs that aren't built yet
MintsyTests/           unit tests (Swift Testing)
```
