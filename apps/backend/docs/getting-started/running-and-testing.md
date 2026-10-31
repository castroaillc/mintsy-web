# Running and testing

Run these from `apps/backend/`, or from the repository root with `pnpm --filter mintsy-backend <script>`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | `tsx watch src/index.ts`: runs the server and restarts on change. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm build` | `tsc`: compiles `src/` to `dist/`. |
| `pnpm start` | `node dist/index.js` (after `pnpm build`). |
| `pnpm test` | `tsx --test test/*.test.ts` (node:test). Needs local MongoDB. |
| `pnpm seed:catalog` | Inserts missing books from `scripts/catalog.json`. See [Seeding the catalog](../catalog/seeding.md). |

Root shortcuts: `pnpm dev:backend`, `pnpm test:backend`.

## Before you open a pull request

```sh
pnpm typecheck && pnpm build
```

CI runs the same checks plus the Docker image, the smoke test and the tests. For auth or route changes, also run the smoke test against a local server.

## Tests

`pnpm test` needs a running local replica set (`docker compose up -d`). The tests use their own database (`TEST_MONGODB_URI`, default `mintsy-test` on localhost) and refuse to run against non-local hosts. `test/env.ts` sets a full test environment before anything from `src/` is imported, so your `.env` doesn't affect them.

| File | Covers |
| --- | --- |
| `test/delete-account.test.ts` | `POST /api/auth/delete-user`: password users vs. social-only users, `REAUTH_REQUIRED`, signed out. |
| `test/progress.test.ts` | `setProgress`, `continueWatching`, `progress(bookId)`, `finishedBookIds` through the GraphQL schema. |
| `test/revenuecat-webhook.test.ts` | RevenueCat webhook with Web Billing (`RC_BILLING`) and Stripe events: trial, renewal, cancellation, expiration, billing grace period. |
| `test/version.test.ts` | `GET /version` shape, build args, and that no secrets leak. No MongoDB needed. |
| `test/web-auth.test.ts` | Auth through the web app's proxy: cookies, OAuth redirect URIs, Apple form_post, trusted origins, and that direct app requests are unchanged. |

## Smoke test

`scripts/smoke-test.sh` runs end-to-end checks against a running server with `curl`: health, sign-up from the app scheme, GraphQL `me` with and without a session, untrusted origins, push-token validation, catalog, Premium, the RevenueCat webhook's auth, My List, watch progress, web origins, social sign-in rejection, password reset, change password and account deletion.

```sh
pnpm dev                                   # in one terminal
scripts/smoke-test.sh http://localhost:4000
```

It ends with `All smoke tests passed`, or prints `FAIL: ...` and exits non-zero.

{% hint style="danger" %}
The smoke test creates (and deletes) a throwaway user. Never point it at production.
{% endhint %}

## Querying locally

```sh
curl -s localhost:4000/health
curl -s localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ books { id title episodes { number title locked } } }"}'
```

To query as a user, sign up or sign in with a cookie jar and send it to `/graphql`:

```sh
curl -s -c jar.txt localhost:4000/api/auth/sign-in/email -H 'Content-Type: application/json' \
  -H 'expo-origin: mintsy://' -d '{"email":"you@example.com","password":"..."}'
curl -s -b jar.txt localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ me { id email premium { active } } }"}'
```
