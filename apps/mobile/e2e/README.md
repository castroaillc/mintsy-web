# mintsy end-to-end suite (Maestro)

Drives the dev build on an iOS simulator through the MVP: sign-up and onboarding, catalog and free/Premium tiers,
playback, paywall (tap and deep link), My List, a freshly published book, Premium via the RevenueCat webhook
(unlock, playback, downloads, badge, Settings), change/forgot/reset password and account deletion.

Each run uses a new account (`e2e+<timestamp>@mintsy.test`) and a new book (`e2e-<timestamp>`), so it can be rerun
against the same database. Run it against an isolated stack, never production: it creates users, publishes content
and sends a fake purchase webhook.

## 1. Bring up the isolated stack

| Piece | Default | Notes |
|---|---|---|
| Mongo | docker `backend-mongo-1`, database `mintsy-e2e` | `docker compose up -d` in `backend/` |
| Backend | `http://localhost:4318` | `backend/`: `MONGODB_DB=mintsy-e2e PORT=4318 REVENUECAT_WEBHOOK_AUTH="Bearer e2e"`, no `RESEND_API_KEY` (email links are printed to stdout) and no `REVENUECAT_SECRET_API_KEY`. Redirect stdout to a log file (`BACKEND_LOG`). Seed with `MONGODB_DB=mintsy-e2e npm run seed:catalog`. |
| Admin | `http://127.0.0.1:3100` | a copy of `mintsy-admin` pointed at `mintsy-e2e` |
| Studio worker | dry run | `tsx pipeline/worker.ts` in dry-run mode on `mintsy-e2e.studio_jobs` (fake media) |
| Metro | `http://localhost:8082` | in `mobile-app/`: `EXPO_PUBLIC_API_URL=http://localhost:4318 npx expo start --dev-client --port 8082` |
| Simulator | booted, dev build `com.getmintsy.app.dev` installed | `npx expo run:ios` or an EAS development build |

The exact env var names for the backend, admin and worker are in each project's `.env.example`.

Maestro 2.x: `curl -fsSL https://get.maestro.mobile.dev | bash`. It needs Java 17
(`brew install openjdk@17`); `run.sh` sets `JAVA_HOME=/opt/homebrew/opt/openjdk@17` by default.

## 2. Run

```bash
cd mobile-app
e2e/run.sh            # every scenario, in order
e2e/run.sh 01 02 03   # only these
STAMP=1793276564 e2e/run.sh 07 08   # later flows reuse the account a previous 01 created (its timestamp)
```

Settings come from environment variables with the defaults at the top of `run.sh`:
`UDID`, `METRO_URL`, `API_URL`, `ADMIN_URL`, `BACKEND_LOG`, `REVENUECAT_WEBHOOK_AUTH`, `MONGO_CONTAINER`, `MONGO_DB`,
`MAESTRO`, `JAVA_HOME`. Set `BACKEND_LOG` to wherever your backend's stdout goes.

Output goes to `e2e/artifacts/<run id>/` (gitignored): `results.txt` (PASS/FAIL per flow), every screenshot, and
each flow's Maestro log and debug output. The script exits non-zero if any flow failed.

## Layout

- `flows/NN-*.yaml`: one flow per scenario; `flows/common/` holds subflows (connect the dev client to Metro and
  dismiss its overlays, open Home, sign in, sign out).
- `run.sh` does the non-UI steps between flows: publishing a book through the admin API (scenario 6), the
  `INITIAL_PURCHASE` webhook (7), and reading the password reset link from the backend log (8).
- Selectors are accessibility labels plus a few `testID`s: text fields are `input-<label>` (e.g.
  `input-confirm-new-password`), submit buttons whose label repeats the screen title have `signup-submit`,
  `signin-submit`, `change-password-submit`, `reset-password-submit`, and section rails are `rail-<title>`
  (e.g. `rail-recently-added`).

## Notes

- The app has no RevenueCat key in this setup, so the paywall shows its "couldn't load the plans" state. Premium is
  simulated with the webhook; relaunching the app picks it up.
- Only `psychology-of-money` episodes 1–5 have a playable video; the newly published book's media is fake.
- The dev client's first launch shows the developer menu onboarding; `flows/common/connect.yaml` dismisses it.
