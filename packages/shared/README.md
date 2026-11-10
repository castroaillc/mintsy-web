# @mintsy/shared

Rules and types that must match across mintsy apps. It's plain JavaScript with type declarations, so there's no build step.

Add `"@mintsy/shared": "workspace:*"` to an app and run `pnpm install` in that app's workspace. Studio is its own workspace and links it from `../../packages/shared`.

The iOS app (`apps/ios`) isn't a pnpm workspace. `apps/ios/scripts/generate-brand.mjs` imports `index.js` directly for `CATEGORIES` and `FREE_EPISODES`, so rerun it after changing them.

The backend doesn't use this package yet, so `FREE_EPISODES` in `apps/backend/src/constants.ts` and `BookDoc` in `apps/backend/src/catalog.ts` must still be changed by hand to match.
