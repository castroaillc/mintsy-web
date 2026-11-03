# mintsy mobile

The mintsy app: Expo and React Native, released to iOS through EAS.

It's its own pnpm workspace with its own lockfile, so install here rather than at the repo root.

## Setup

```sh
pnpm install
cp .env.example .env
```

## Run

```sh
pnpm start           # expo start; or `pnpm dev:mobile` from the repo root
pnpm ios             # expo run:ios
```

Checks: `npx expo lint`, `npx tsc --noEmit`, `pnpm test`. End-to-end tests: [`e2e/README.md`](e2e/README.md).

## Documentation

The architecture, Premium and store setup checklist, and release steps are in the docs:
[`apps/docs/services/mobile.md`](../docs/services/mobile.md).
