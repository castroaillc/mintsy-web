# @mintsy/shared

Rules and types that must match across mintsy apps. It's plain JavaScript with type declarations, so there's no build step.

Add `"@mintsy/shared": "workspace:*"` to an app and run `pnpm install` in that app's workspace. `apps/mobile` is its own workspace. Studio links it from `../mintsy-web/packages/shared`.

The backend doesn't use this package yet, so `FREE_EPISODES` in `apps/backend/src/constants.ts` and `BookDoc` in `apps/backend/src/catalog.ts` must still be changed by hand to match.
