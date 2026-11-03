# @mintsy/brand

Everything about how mintsy looks, in one package: colors, fonts, logos, icons and tokens for JS and CSS.

Everything is generated from **`src/tokens.mjs`**.

## Install

Add it to an app's `package.json` and run `pnpm install` in that app's workspace. `apps/mobile` is its own pnpm workspace, so install there separately.

```jsonc
"@mintsy/brand": "workspace:*"
```

## Build

`dist/` and `css/` are committed, so nothing needs to build on install. After changing `src/tokens.mjs`:

```sh
npm run build        # regenerates dist/ and css/; commit the output
npm run icons        # re-renders the app icons (needs Playwright)
npm run logos        # regenerates the logo outlines (needs Python with fontTools)
```

## Documentation

How to use it in each app, the theme and every export are in the docs:
[`apps/docs/services/brand.md`](../../apps/docs/services/brand.md).
