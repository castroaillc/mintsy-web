---
name: mobile-release
description: Building and shipping the mintsy app with EAS (development builds, TestFlight, OTA updates) and deciding which one a change needs.
---
# Releasing the app

Run from `apps/mobile/`, as `npx eas-cli@latest <cmd>`. **Every build, submit and update needs approval.**

Profiles in `eas.json`: `development` (dev client, `Mintsy Dev`), a simulator variant of it, `preview` (internal) and `production` (auto-increment, App Store). Each has a channel of the same name. App versions are remote, and `runtimeVersion` uses the `fingerprint` policy.

## Which release does a change need?

| Change | Ship with |
|---|---|
| JS/TS, styles, assets only | `eas update` to the matching channel |
| Native module, config plugin, `app.config.ts` permissions or entitlements, Expo SDK bump | New `eas build`, then `eas submit` for TestFlight |
| Catalog content | Nothing. Admin publishes it and the app reads it from the API |

The fingerprint decides which builds an update can reach, so a change that alters it can't ship as an OTA update even if it looks JS-only.

**Set the variant on every update.** `preview` and `production` builds use `APP_VARIANT=production`, and leaving it out publishes the development variant under a runtime no such build has:

```sh
APP_VARIANT=production npx eas-cli@latest update --channel preview --environment preview --platform ios --message "..." --non-interactive
```

After publishing, compare the printed runtime with the build's (`eas build:view <id> --json`, `runtime.version`). "Published" alone doesn't mean a device will receive it.

## Before any release

1. `npx expo-doctor`, `npx expo lint`, `npx tsc --noEmit` and `npm test` all pass.
2. Confirm the production API already serves every field the app queries. The backend ships first.
3. If permissions or data collection changed, report it, so the privacy policy at `apps/web/src/app/privacy/page.tsx` is updated and approved before App Review.
4. Report the profile, channel, build number and the build URL EAS prints.
