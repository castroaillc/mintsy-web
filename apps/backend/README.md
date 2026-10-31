# mintsy-backend (`apps/backend`)

Part of the `mintsy-web` pnpm monorepo: one lockfile at the repo root, shared with `apps/web` and
`apps/admin`. Run the commands below from this folder (`apps/backend`), or from the repo root as
`pnpm --filter mintsy-backend <script>` (`pnpm dev:backend`, `pnpm test:backend`).

> Production still deploys from the standalone `castroaillc/mintsy-backend` repo until the cutover
> to `castroaillc/mintsy-web` (see "Deploy (production)").

Node + TypeScript + Express 5, Apollo Server (GraphQL), Better Auth (email/password, Sign in with Google / Apple, OpenAPI plugin), MongoDB.

## Setup

```sh
pnpm install                  # installs the whole workspace (run anywhere in the repo)
cp .env.example .env          # set BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # local MongoDB (single-node replica set)
pnpm dev
```

## Endpoints

| Path | Description |
| --- | --- |
| `POST /api/auth/sign-up/email` | Register `{ email, password, name }` |
| `POST /api/auth/sign-in/email` | Log in `{ email, password }`; sets the session cookie |
| `POST /api/auth/sign-in/social` | `{ provider: "google" \| "apple", idToken: { token, nonce? } }` (native ID token); sets the session cookie. See "Sign in with Google / Apple" |
| `GET /api/auth/list-accounts` | The user's sign-in methods (`providerId`: `credential`, `google`, `apple`) |
| `POST /api/auth/sign-out` | Log out |
| `GET /api/auth/get-session` | Current session |
| `POST /api/auth/request-password-reset` | Email a reset link `{ email, redirectTo }` (see "Account flows") |
| `GET /api/auth/reset-password/:token` | Reset link target; redirects to `<redirectTo>?token=...` |
| `POST /api/auth/reset-password` | `{ newPassword, token }` |
| `POST /api/auth/change-password` | `{ currentPassword, newPassword, revokeOtherSessions }` |
| `POST /api/auth/change-email` | `{ newEmail, callbackURL }`; emails a confirmation link to the new address |
| `GET /api/auth/verify-email` | Email-change link target; redirects to `callbackURL` |
| `POST /api/auth/delete-user` | `{ password }` (or `{}` for social-only users with a fresh session); deletes the account and all its data immediately |
| `GET /api/auth/reference` | OpenAPI reference UI for all auth routes |
| `POST /graphql` | GraphQL API (Apollo Sandbox on GET in dev); `books` / `book(id)` serve the catalog, `search(query)` searches it, `setProgress` / `me.continueWatching` track watch progress |
| `POST /webhooks/revenuecat` | RevenueCat webhook (subscription events → `entitlements`); see "Premium" |
| `GET /health` | Health check |
| `GET /version` | Running build: `{ name, version, commit, buildTime, revision, env, startedAt, uptimeSeconds }`. `version` from package.json; `commit` / `buildTime` from the `GIT_SHA` / `BUILD_TIME` Docker build args (in dev `commit` is `git rev-parse --short HEAD` when available, else null); `revision` is Cloud Run's `K_REVISION` (null elsewhere); `env` is `NODE_ENV` (`development` when unset). Public, no database, `Cache-Control: no-store` |

The GraphQL context carries the Better Auth session (`ctx.session`); see the `me` query in `src/graphql/schema.ts`.

## Notes

- MongoDB must be a replica set (Atlas always is) because Better Auth uses transactions.
- Local dev uses the `mintsy` database (`MONGODB_URI=mongodb://localhost:27017/mintsy?directConnection=true` in `.env.example`), the same name as production and the default of the studio worker and admin dashboard, so the API serves what the admin publishes. If your existing local `.env` still points at `/backend`, change it to `/mintsy`; your old local data stays in the `backend` database (copy it over with `mongodump`/`mongorestore --nsFrom 'backend.*' --nsTo 'mintsy.*'` if you need it).
- Better Auth is mounted before `express.json()`, which it requires.

## Scripts

`pnpm dev` · `pnpm build` · `pnpm start` · `pnpm typecheck` · `pnpm test` · `pnpm seed:catalog`

`pnpm test` runs `test/*.test.ts` (node:test via tsx) against a local MongoDB replica set
(`TEST_MONGODB_URI`, default `mongodb://localhost:27017/mintsy-test?directConnection=true`; it refuses non-local hosts).

## Catalog and episode videos

The book catalog lives in the `books` collection (one document per book, episodes embedded).
**MongoDB is the source of truth.** The studio worker inserts draft books and episodes, and staff edit
and publish them in the local admin dashboard (`apps/admin/` in this monorepo). Books and episodes carry
`status: "draft" | "published"` (missing = published, for docs that predate drafts).

The public `books` / `book(id)` GraphQL queries go through `listPublishedBooks()` / `getPublishedBook()`
in `src/catalog.ts`: draft books are hidden, and each book only shows the contiguous run of published
episodes starting at episode 1 (a book with none is hidden). Nothing reaches the app until it's published.

`scripts/catalog.json` and `pnpm seed:catalog` are a legacy bootstrap only: the script inserts books
that don't exist yet (`$setOnInsert`) and never overwrites or deletes existing ones.

Videos are plain MP4 files in the public Cloud Storage bucket `gs://mintsy-media` (project
`mintsy-prod`). The database stores object paths; `Episode.videoUrl` / `thumbnailUrl` are
`MEDIA_BASE_URL` + path, so a CDN or custom domain later is only an env change.

**One-time bucket setup** (public bucket; see "Locking the media" below for the private, signed-URL setup)

```sh
gcloud storage buckets create gs://mintsy-media --project mintsy-prod --location us-central1 --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding gs://mintsy-media --member allUsers --role roles/storage.objectViewer
```

**Adding an episode video**

Normally the studio worker's `render` job encodes, uploads and upserts the draft episode, and you
publish it from the admin dashboard. To do it by hand:

1. Encode to 720p H.264 MP4. `+faststart` lets playback start before the whole file downloads:
   ```sh
   ffmpeg -i in.mov -vf scale=-2:720 -c:v libx264 -preset slow -crf 23 -maxrate 1.8M -bufsize 3.6M \
     -c:a aac -b:a 128k -movflags +faststart 4.mp4
   ffmpeg -ss 5 -i 4.mp4 -frames:v 1 -vf scale=264:-2 4.jpg
   ```
2. Upload. Files are cached for a year, so upload a changed video under a new name (e.g. `4-v2.mp4`):
   ```sh
   gcloud storage cp 4.mp4 4.jpg gs://mintsy-media/books/psychology-of-money/ \
     --cache-control "public, max-age=31536000"
   ```
3. Set the episode's `videoPath` / `thumbnailPath` (e.g. `books/psychology-of-money/4.mp4`) and a
   matching `durationSec` in the admin dashboard, then publish it.

## Premium (free tier, RevenueCat)

Episodes `1..FREE_EPISODES` (3, in `src/constants.ts`; the app has the same constant) of every book are
free. Later episodes need the RevenueCat entitlement `premium`. The app identifies RevenueCat customers
with the Better Auth user id (`Purchases.logIn(user.id)`), so RevenueCat's `app_user_id` = our user id.

**GraphQL**

```graphql
type Premium { active: Boolean!, expiresAt: String, willRenew: Boolean!, periodType: String, productId: String, store: String }
type User    { ..., premium: Premium! }
type Episode { ..., locked: Boolean! }   # number > 3 && viewer isn't premium (signed out = not premium)
type Mutation { ..., refreshPremium: Premium! }   # session required; refetch from RevenueCat, store, return
```

A locked episode has `videoUrl: null`, `transcript: []` and `takeaways: []`; title, summary, duration and
thumbnail stay. The viewer's entitlement is read once per request (`ctx.viewerPremium()`).
`active` is false once `expiresAt` (or a billing grace period) has passed, even if the stored flag is stale.
`store` is where it was bought, lowercased from RevenueCat: `app_store`, `rc_billing` (RevenueCat Web Billing on
the web app), `stripe`, `play_store`, `promotional`, ...; clients send users to manage the subscription there.

**Web Billing:** the web app sells through RevenueCat Web Billing with the same entitlement `premium` and
`app_user_id` = Better Auth user id. Its webhook events (`store: "RC_BILLING"`, or `"STRIPE"` for the Stripe
integration) go through the same webhook and code path as App Store events (trial, renewal, cancellation,
billing issue, expiration); see `test/revenuecat-webhook.test.ts`.

**Storage**

- `entitlements`: one doc per user `{ userId, active, productId, periodType, expiresAt, graceExpiresAt,
  willRenew, store, updatedAt, lastEventAtMs }`, unique on `userId`. No doc = never subscribed.
- `revenueCatEvents`: processed webhook event ids (`_id`), expire after 90 days.

**Webhook** `POST https://api.getmintsy.com/webhooks/revenuecat`

- In RevenueCat (Project → Integrations → Webhooks): URL above, and set the **Authorization header value**
  to a random string, e.g. `Bearer $(openssl rand -hex 32)`. Put the exact same string in
  `REVENUECAT_WEBHOOK_AUTH`. Unset = the endpoint answers 503; a mismatch = 401 (constant-time compare).
- Idempotent by `event.id` (RevenueCat retries reuse it) and order-safe by `event.event_timestamp_ms`:
  an event older than the newest one applied to that user is ignored.
- With `REVENUECAT_SECRET_API_KEY` set (recommended), every event triggers
  `GET https://api.revenuecat.com/v1/subscribers/{app_user_id}` and that state is stored. Without it,
  state comes from the event payload (INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, CANCELLATION,
  UNCANCELLATION, EXPIRATION, BILLING_ISSUE, TRANSFER) and `refreshPremium` just returns what's stored
  (logs a warning).
- TRANSFER updates every user in `transferred_from` and `transferred_to`. Anonymous ids
  (`$RCAnonymousID:...`), `TEST` events and other entitlements are acknowledged with 200 and ignored.
  Processing errors answer 500 so RevenueCat retries.
- Note: the REST call creates the RevenueCat customer if it doesn't exist (the app's `logIn` does too).

**Production config:** add `REVENUECAT_WEBHOOK_AUTH` and `REVENUECAT_SECRET_API_KEY` (a v1 secret key,
`sk_...`) to Secret Manager and expose them to `mintsy-api`:

```sh
printf '%s' 'Bearer <random>' | gcloud secrets create REVENUECAT_WEBHOOK_AUTH --project mintsy-prod --data-file=-
printf '%s' 'sk_...'          | gcloud secrets create REVENUECAT_SECRET_API_KEY --project mintsy-prod --data-file=-
SA=$(gcloud run services describe mintsy-api --region us-central1 --project mintsy-prod \
  --format 'value(spec.template.spec.serviceAccountName)')   # empty = default compute SA
for s in REVENUECAT_WEBHOOK_AUTH REVENUECAT_SECRET_API_KEY; do
  gcloud secrets add-iam-policy-binding $s --project mintsy-prod \
    --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
done
gcloud run services update mintsy-api --region us-central1 --project mintsy-prod \
  --update-secrets REVENUECAT_WEBHOOK_AUTH=REVENUECAT_WEBHOOK_AUTH:latest,REVENUECAT_SECRET_API_KEY=REVENUECAT_SECRET_API_KEY:latest
```

Then use RevenueCat's "Send test event" (expect 200, logged as ignored).

**Local test:** set `REVENUECAT_WEBHOOK_AUTH=Bearer test` and post an event:

```sh
curl -X POST localhost:4000/webhooks/revenuecat -H 'Content-Type: application/json' -H 'Authorization: Bearer test' \
  -d '{"api_version":"1.0","event":{"id":"evt-1","type":"INITIAL_PURCHASE","event_timestamp_ms":'$(date +%s000)',
       "app_user_id":"<user id from { me { id } }>","product_id":"yearly","period_type":"TRIAL",
       "expiration_at_ms":'$(( $(date +%s) + 604800 ))000',"entitlement_ids":["premium"],"store":"APP_STORE"}}'
```

## Locking the media (`SIGNED_MEDIA`)

With a public bucket anyone can fetch `books/<id>/<n>-<hash>.mp4` directly, so the free tier would only be
enforced in the UI. With `SIGNED_MEDIA=true` the bucket is private and the API hands out
[V4 signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls) (`src/media.ts`):

- `Episode.videoUrl`: signed for **~1 hour** (60–90 min left when issued), and only for unlocked episodes.
- `Episode.thumbnailUrl`: signed for **~7 days** (the V4 maximum). Thumbnails are allowed to be public, but
  a private bucket makes every object private and studio uploads both into the same bucket, so they're
  signed too. Trade-off: no public CDN URLs for thumbnails, but no second bucket and no studio change.
  (Alternative: a separate public `mintsy-thumbs` bucket, which needs studio to upload JPGs there and a
  `thumbnailPath` base change; not done.)
- Signed URLs are aligned to time windows (video: 30 min, thumbnail: 1 day) and memoized in-process, so
  the same object gets the same URL within a window. Client caches keep working, and the API makes one
  signing call per object per window, not per request.
- On Cloud Run there's no key file; the library signs via the IAM Credentials `signBlob` API as the
  runtime service account, which therefore needs **Service Account Token Creator on itself**
  (`iam.serviceAccounts.signBlob`) plus read access to the bucket. Signing failures are logged and the
  field returns null.
- `MEDIA_BASE_URL` is ignored for signed URLs (they're always `https://storage.googleapis.com/<bucket>/...`).
  `MEDIA_BUCKET` sets the bucket name (default `mintsy-media`).

**Steps (Steve runs these; nothing here has been run).** Order matters: deploy the code and turn the flag
on *before* closing the bucket, so the app never gets URLs that 403.

```sh
PROJECT=mintsy-prod; REGION=us-central1; BUCKET=gs://mintsy-media
# 0. Find the Cloud Run runtime service account (empty = PROJECT_NUMBER-compute@developer.gserviceaccount.com)
SA=$(gcloud run services describe mintsy-api --region $REGION --project $PROJECT \
  --format 'value(spec.template.spec.serviceAccountName)')
[ -z "$SA" ] && SA="$(gcloud projects describe $PROJECT --format 'value(projectNumber)')-compute@developer.gserviceaccount.com"
echo $SA

# 1. Let the service account sign as itself (signBlob) and read objects
gcloud iam service-accounts add-iam-policy-binding $SA --project $PROJECT \
  --member "serviceAccount:$SA" --role roles/iam.serviceAccountTokenCreator
gcloud storage buckets add-iam-policy-binding $BUCKET \
  --member "serviceAccount:$SA" --role roles/storage.objectViewer
gcloud services enable iamcredentials.googleapis.com --project $PROJECT

# 2. Deploy this code (merge to main), then turn signing on. URLs are signed; the bucket is still public.
gcloud run services update mintsy-api --region $REGION --project $PROJECT --update-env-vars SIGNED_MEDIA=true
#    Check: { books { episodes { number locked videoUrl thumbnailUrl } } } returns X-Goog-Signature URLs that play.

# 3. Close the bucket: remove public read, enforce uniform access and public access prevention
gcloud storage buckets remove-iam-policy-binding $BUCKET --member allUsers --role roles/storage.objectViewer
gcloud storage buckets update $BUCKET --uniform-bucket-level-access --public-access-prevention

# 4. Verify: the plain URL is now 403, a signed one is 200
curl -sI https://storage.googleapis.com/mintsy-media/books/<bookId>/<file>.mp4 | head -1   # 403
```

Note: objects uploaded with `Cache-Control: public, max-age=31536000` may still sit in Google's edge cache
or other shared caches for up to their max-age after step 3. Content-hashed names mean new uploads aren't
affected; studio should switch new uploads to `private, max-age=31536000`.

**Rollback** (re-open the bucket first, then turn signing off):

```sh
gcloud storage buckets update $BUCKET --no-public-access-prevention
gcloud storage buckets add-iam-policy-binding $BUCKET --member allUsers --role roles/storage.objectViewer
gcloud run services update mintsy-api --region $REGION --project $PROJECT --update-env-vars SIGNED_MEDIA=false
```

(Leaving `SIGNED_MEDIA=true` on a public bucket also works; signed URLs remain valid.)

## Email (Resend)

`src/email.ts` sends transactional email (password reset, email change) through
[Resend](https://resend.com)'s HTTP API: short branded HTML + plain text, no images, no tracking pixels.

- `RESEND_API_KEY` (`re_...`): unset = emails aren't sent; the recipient, subject and links are logged to the
  console instead (links only outside production), so local dev and the smoke test work. In production a
  missing key logs an error at startup and on every email.
- `EMAIL_FROM`: default `mintsy <no-reply@getmintsy.com>`. Its domain must be verified in Resend.

**One-time Resend setup:** Resend → Domains → add `getmintsy.com` (or a subdomain such as `mail.getmintsy.com`,
then use `no-reply@mail.getmintsy.com`), add the SPF/DKIM DNS records it shows (and optionally DMARC), wait
for "Verified". Leave open and click tracking **off** for the domain. Create an API key with "Sending
access" for that domain and store it as the secret `RESEND_API_KEY`:

```sh
printf '%s' 're_...' | gcloud secrets create RESEND_API_KEY --project mintsy-prod --data-file=-
# grant the Cloud Run service account secretAccessor (as for the RevenueCat secrets), then:
gcloud run services update mintsy-api --region us-central1 --project mintsy-prod \
  --update-secrets RESEND_API_KEY=RESEND_API_KEY:latest
```

Emails are sent in the background (`advanced.backgroundTasks`) so requests don't wait on Resend, and a reset
request for an unknown address takes as long as one for a known address. On Cloud Run with request-based CPU
allocation, a send may be slowed once the response has gone out; if emails arrive late, set
`--no-cpu-throttling` on the service.

## Account flows (Better Auth)

App deep-link schemes `mintsy://` and `mintsy-dev://` are trusted origins, so `redirectTo` / `callbackURL`
values on them pass Better Auth's checks; anything else (e.g. `https://evil...`) gets 403.

**Password reset.** The app calls `authClient.requestPasswordReset({ email, redirectTo: "mintsy://reset-password" })`.
The response is the same whether or not the email exists. The email links to
`/api/auth/reset-password/<token>?callbackURL=mintsy://reset-password`, which redirects to
`mintsy://reset-password/?token=<token>` (or `?error=INVALID_TOKEN` when expired/used). The app calls
`authClient.resetPassword({ newPassword, token })`. Tokens last 1 hour and are single-use; a reset signs
out every session (`revokeSessionsOnPasswordReset`).

**Change password.** `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`;
the calling device gets a new session, other devices are signed out.

**Change email.** `authClient.changeEmail({ newEmail, callbackURL: "mintsy://email-changed" })` emails a
confirmation link to the new address and a heads-up (no link) to the current one. The stored email only
changes when the link is opened; it then becomes `emailVerified: true` and the browser is redirected to
`mintsy://email-changed`, or `mintsy://email-changed/?error=<CODE>` (`TOKEN_EXPIRED`, `INVALID_TOKEN`,
`USER_NOT_FOUND` when the link was already used, `INVALID_USER`). Links last 1 hour. If the new address
already belongs to an account, the response is the same but nothing is sent. Opening the link doesn't
create a session (an `after` hook revokes the one Better Auth would create and keeps the token out of the
deep link). Sign-up doesn't send verification emails.

**Delete account** (App Store 5.1.1(v)). `authClient.deleteUser({ password })`. A `before` hook decides:

- The user has a password (a `credential` account): the password is required (`400 PASSWORD_REQUIRED` without
  one, `400 INVALID_PASSWORD` when wrong), however old the session is.
- The user has no password (Google / Apple only): `deleteUser({})` works when the session was created less than
  10 minutes ago; otherwise `403 REAUTH_REQUIRED`. The app then signs in with Google / Apple again (a new,
  fresh session) and retries. (Sending a password here gets Better Auth's `400 CREDENTIAL_ACCOUNT_NOT_FOUND`.)

Deletion is immediate on both paths: `src/account.ts` removes the user's push tokens, entitlement,
saved items, watch progress and pending verification tokens (before and again after Better Auth deletes the user, sessions
and accounts), then calls RevenueCat `DELETE /v1/subscribers/{id}` when `REVENUECAT_SECRET_API_KEY` is set
(failures are logged, not fatal). It logs `[audit] account deleted: user <id>` (no email). It does **not**
cancel an App Store / Play subscription; the app tells the user to cancel in the store.

## Sign in with Google / Apple

The app uses the **native ID-token flow** (no browser redirect): it gets an ID token from
`@react-native-google-signin/google-signin` or `expo-apple-authentication` and calls
`authClient.signIn.social({ provider, idToken: { token, nonce?, accessToken? } })` →
`POST /api/auth/sign-in/social`. The response and session cookie are the same as email sign-in
(`{ redirect: false, token, user }`). Apple's `nonce` is the raw nonce (its SHA-256 went to Apple); Better Auth
accepts the raw or hashed value. Apple only sends the user's name on the first authorization, so the app should
pass it as `idToken.user: { name: { firstName, lastName } }` on that call.

- **Config** (`src/auth.ts`, `src/env.ts`): a provider is only configured when its client ID is set; otherwise the
  server logs a warning at startup and `sign-in/social` for it answers `404 PROVIDER_NOT_FOUND`. Local dev and CI
  run without any of these.
  - Google: `GOOGLE_CLIENT_ID` (web client) and/or `GOOGLE_IOS_CLIENT_ID` (comma-separated); ID tokens with any of
    these audiences are accepted. `GOOGLE_CLIENT_SECRET` is only used by the browser redirect flow.
  - Apple: `APPLE_CLIENT_ID` (Services ID). Accepted audiences: every bundle ID in `APPLE_APP_BUNDLE_IDENTIFIER`
    (comma-separated, default `com.getmintsy.app,com.getmintsy.app.dev`) plus the Services ID.
    `APPLE_CLIENT_SECRET` (the ES256 client-secret JWT) is only used by the browser redirect flow.
    `https://appleid.apple.com` is a trusted origin while Apple is configured (form_post callback, web only).
- **Errors:** a bad, expired or wrong-audience token is `401 INVALID_TOKEN`; a token without an email is
  `401 USER_EMAIL_NOT_FOUND`; an existing account it can't link to is `401 OAUTH_LINK_ERROR`
  (message `account not linked`).
- **Account linking** (`account.accountLinking`, trusted providers `google`, `apple`): a sign-in whose email
  matches an existing user is linked to that user, **only if the existing user's email is verified**
  (Better Auth's `requireLocalEmailVerified`, default on, which stops someone pre-registering a password account
  on another person's address and later sharing their Google/Apple account). Email sign-up here doesn't verify
  addresses, so most password accounts get `OAUTH_LINK_ERROR` instead; they sign in with the password.
  Apple private-relay addresses (`...@privaterelay.appleid.com`) never match, so they create a new user.
- **Which methods a user has:** `authClient.listAccounts()` → `GET /api/auth/list-accounts`:
  `[{ id, providerId: "credential" | "google" | "apple", accountId, userId, createdAt, updatedAt, scopes: string[] }]`.
  No `credential` entry = no password (hide change email / change password).

**One-time setup** (production values go to Cloud Run; client IDs and bundle IDs aren't secret, so plain env vars):

- Google Cloud console → APIs & Services: configure the OAuth consent screen, then Credentials → Create OAuth
  client ID, once as **Web application** (`GOOGLE_CLIENT_ID`, plus its secret `GOOGLE_CLIENT_SECRET`; authorized redirect
  URIs `https://app.getmintsy.com/api/auth/callback/google` and, for dev, `http://localhost:3000/api/auth/callback/google`) and once as
  **iOS** with bundle ID `com.getmintsy.app` (`GOOGLE_IOS_CLIENT_ID`). iOS clients are per bundle ID, so dev
  builds (`com.getmintsy.app.dev`) need a second iOS client; `GOOGLE_IOS_CLIENT_ID` takes a comma-separated list.
- Apple Developer → Identifiers: enable **Sign in with Apple** on the App IDs `com.getmintsy.app` and
  `com.getmintsy.app.dev`; create a **Services ID** (`APPLE_CLIENT_ID`) with Sign in with Apple enabled
  (domain `app.getmintsy.com`, return URL `https://app.getmintsy.com/api/auth/callback/apple`, only used by the
  web app's redirect flow; see "Web app"). For the web flow only: Keys → create a key with Sign in with Apple and generate the client-secret
  JWT from it (`APPLE_CLIENT_SECRET`, expires after at most 6 months).
- Apple Developer → Services → **Sign in with Apple for Email Communication**: register the sending domain
  (`getmintsy.com`, or the Resend subdomain) and/or the address in `EMAIL_FROM`, so password-reset and
  email-change mail reaches `@privaterelay.appleid.com` addresses. The domain's SPF must pass (Resend's records).

## Web app (app.getmintsy.com)

The Next.js web app (`mintsy-web/`) never calls this API from the browser directly. Next.js rewrites
`https://app.getmintsy.com/api/auth/:path*` → `https://api.getmintsy.com/api/auth/:path*` and
`/graphql` → `https://api.getmintsy.com/graphql`, so the session cookie is a first-party, host-only cookie on
`app.getmintsy.com` (`__Secure-better-auth.session_token`, `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`).
No `crossSubDomainCookies`.

- **Base URL** (`src/auth.ts`): Better Auth's dynamic `baseURL` with `allowedHosts` = the `BETTER_AUTH_URL` host plus
  the web hosts with the same scheme, `protocol` fixed to `BETTER_AUTH_URL`'s, `fallback` = `BETTER_AUTH_URL`, and
  `advanced.trustedProxyHeaders: true`. A request with `X-Forwarded-Host: app.getmintsy.com` (sent by the proxy)
  gets `https://app.getmintsy.com/api/auth` as its base URL, so OAuth redirect URIs, Apple's form_post redirect and
  email links stay on the web host. Anything else (the iPhone app, the `*.run.app` URL, a forged host) uses
  `BETTER_AUTH_URL` exactly as before; cookie names don't change.
- **Trusted origins / CORS:** `https://app.getmintsy.com` always, `http://localhost:3000` outside production
  (`env.webOrigins`), so `Origin` checks, `redirectTo: "https://app.getmintsy.com/reset-password"` and
  `callbackURL: "https://app.getmintsy.com/profile/settings"` pass. They're also allowed by CORS on every route.
- **Google / Apple on the web** use the redirect flow (`authClient.signIn.social({ provider, callbackURL })`), which
  needs `GOOGLE_CLIENT_SECRET` / `APPLE_CLIENT_SECRET`. Redirect URIs to register:
  `https://app.getmintsy.com/api/auth/callback/google` (Google web client; plus `http://localhost:3000/api/auth/callback/google`
  for local dev) and `https://app.getmintsy.com/api/auth/callback/apple` (Apple Services ID, domain `app.getmintsy.com`;
  Apple doesn't accept localhost). Apple POSTs the callback (`form_post`); Better Auth answers with a 302 to the same
  URL as a GET on the web host, where the `SameSite=Lax` state cookie is sent.
- Tested in `test/web-auth.test.ts`.

## Watch progress

```graphql
type EpisodeProgress { id: ID!, episodeId: ID!, bookId: ID!, episodeNumber: Int!, positionSec: Int!, durationSec: Int!,
                       completed: Boolean!, updatedAt: String!, episode: Episode, book: Book }
type User     { ..., continueWatching(limit: Int = 10): [EpisodeProgress!]!, progress(bookId: ID!): [EpisodeProgress!]!,
                finishedBookIds: [ID!]! }
type Mutation { ..., setProgress(episodeId: ID!, positionSec: Int!, completed: Boolean): EpisodeProgress! }
```

Stored in `watch_progress` (`src/progress.ts`): `{ userId, episodeId, bookId, episodeNumber, positionSec, durationSec,
completed, updatedAt }`, unique on `{ userId, episodeId }`, indexed on `{ userId, updatedAt: -1 }` and
`{ userId, bookId, episodeNumber }`.

- `setProgress` needs a session and a published episode (`BAD_USER_INPUT` "Unknown episode"); locked episodes are
  `FORBIDDEN` "Premium required". `positionSec` is clamped to `[0, durationSec]`. `completed: true/false` sets it;
  null keeps it, and a position ≥ 95% of the duration sets it (rewatching a finished episode keeps it finished).
  Last write wins by server time, except that a backwards move within 2 s of the previous save is ignored as an
  out-of-order delivery (completion changes always apply).
- `continueWatching`: one entry per book, most recent activity first: the latest episode if unfinished, otherwise
  the next unfinished one (position 0 if never started; it may be locked, `episode.locked: true`). Fully finished
  books are skipped. `limit` 0-50.
- `finishedBookIds`: published books whose every published episode is completed. A newly published episode makes
  the book unfinished again and shows up in `continueWatching`.

## My List (saved books and episodes)

```graphql
enum SavedKind { BOOK EPISODE }
type User     { ..., savedBookIds: [ID!]!, savedEpisodeIds: [ID!]! }   # most recently saved first
type Mutation { ..., setSaved(kind: SavedKind!, id: ID!, saved: Boolean!): User! }
```

Stored in `saved_items` (`{ userId, kind: "book" | "episode", id, savedAt }`, unique on `{ userId, kind, id }`).
`setSaved` needs a session, is idempotent (re-saving keeps the original position), checks the id exists in
the catalog when saving (drafts count; the error is just "Unknown id"), and allows 500 per kind. Removing
never checks the catalog. Ids of items later removed from the catalog are still returned; the app skips them.

## Search and key ideas

```graphql
type Query    { ..., search(query: String!): SearchResult! }   # public, works signed out
type SearchResult { books: [Book!]!, episodes: [EpisodeMatch!]! }
type EpisodeMatch {
  id: ID!                 # <bookId>-<number>-<startSec>
  bookId: ID!, bookTitle: String!, episodeId: ID!, episodeNumber: Int!, episodeTitle: String!
  episode: Episode!
  startSec: Int!          # start of the matching transcript line
  snippet: String!        # ~80-120 chars around the match, … when cut
  matchStart: Int!, matchLength: Int!   # UTF-16 offsets of the match in snippet
}
type Book     { ..., keyIdeas: [String!]! }   # "The book in 5 ideas", at most 5
```

**`search`** (`src/search.ts`) scans the published catalog (`listPublishedBooks()`, so drafts and episodes
past the published run are never searched). The query is whitespace-collapsed, trimmed and cut to 100
characters; under 2 characters returns empty lists without touching the database. Matching is a
case-insensitive literal substring (regex input is escaped; a space matches any whitespace; `'` matches `’`).

- `books`: title, author or category contains the query; title matches first, then author, then
  category, catalog order within each. At most 20.
- `episodes`: one match per transcript line (first occurrence), at most 3 per episode and 30 in total.
  Matched books are scanned first, then the rest of the catalog, in episode and time order.
- **Locked episodes are skipped**: a locked episode's transcript is `[]` in the API, so search doesn't
  look into it either. Signed-out and free viewers only get matches from episodes 1..`FREE_EPISODES`.
- Follow-up: once the catalog grows, replace the scan (it loads every published book per search) with a
  MongoDB text index or Atlas Search on title/author/category/`episodes.transcript.text`.

**`Book.keyIdeas`**: `BookDoc.keyIdeas?: string[]` when present and non-empty (trimmed, deduplicated, first
5; curated book-level copy, shown to everyone like the description). Otherwise derived: the first takeaway
of each episode the viewer can unlock, in order, deduplicated, first 5. Free viewers therefore get at most
3, from the free episodes; locked takeaways never leak. Studio (generate) and admin (edit) may write it;
`scripts/catalog.json` doesn't need it.

## Deploy (production)

Production runs on **Google Cloud Run** (`mintsy-api`, us-central1) at **https://api.getmintsy.com**, with **MongoDB Atlas** (Free cluster, database `mintsy`).

- **CI/CD** (`.github/workflows/backend.yml` at the repo root) runs on pushes and pull requests that touch `apps/backend/**` or the workflow:
  1. **Typecheck & build:** `pnpm typecheck` and `pnpm build`, after `pnpm install --frozen-lockfile --filter mintsy-backend...` at the root.
  2. **Integration:** builds the production Docker image from the repo root (`docker build -f apps/backend/Dockerfile .`), runs it against a MongoDB replica set, and runs `scripts/smoke-test.sh` (sign-up, session, GraphQL `me`, origin and push-token checks).
  3. **Deploy:** **disabled in this repo (`if: false`)** until `castroaillc/mintsy-web` exists on GitHub, the Workload Identity provider / `github-deployer` service-account binding trusts that repo, and the cutover is approved. Until then production deploys from `castroaillc/mintsy-backend`. Once enabled: only on pushes to `main`, and only if steps 1 and 2 pass. It builds and pushes the image to Artifact Registry and deploys it to Cloud Run, authenticating with Workload Identity Federation, so no key is stored in GitHub.
- **Dependabot** (`.github/dependabot.yml` at the repo root, whole workspace) opens weekly update PRs for npm packages and GitHub Actions, and they go through the same checks.
- **Smoke test locally:** `scripts/smoke-test.sh http://localhost:4000`. It creates a throwaway user, so don't point it at production.
- **Config:** plain env vars `BETTER_AUTH_URL=https://api.getmintsy.com`, `MONGODB_DB=mintsy` and `CORS_ORIGINS=` (the web app's origin is built in; see "Web app"). Secrets come from Secret Manager: `MONGODB_URI`, `BETTER_AUTH_SECRET`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_SECRET_API_KEY`, `RESEND_API_KEY` and optionally `EXPO_ACCESS_TOKEN`. Optional plain env var: `EMAIL_FROM`. Optional plain env vars: `SIGNED_MEDIA=true` (see "Locking the media") and `MEDIA_BUCKET`. Sign in with Google / Apple: plain env vars `GOOGLE_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `APPLE_CLIENT_ID`, optionally `APPLE_APP_BUNDLE_IDENTIFIER`; secrets `GOOGLE_CLIENT_SECRET` and `APPLE_CLIENT_SECRET` (both optional, needed for the web app's redirect flow).
- **Production behavior** (`NODE_ENV=production`, set in the image):
  - The OpenAPI auth reference is disabled.
  - GraphQL introspection and Apollo Sandbox are off.
  - `exp://` dev origins are not trusted.
- **Local image test** (the build context is the repo root, because the lockfile lives there; `apps/backend/Dockerfile.dockerignore` limits it to the backend):
  ```sh
  # from the repo root
  docker build -f apps/backend/Dockerfile -t mintsy-api:local \
    --build-arg GIT_SHA=$(git rev-parse HEAD) --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) .
  docker run -p 8090:8080 -e PORT=8080 \
    -e "MONGODB_URI=mongodb://host.docker.internal:27017/mintsy-test?directConnection=true" \
    -e BETTER_AUTH_SECRET=$(openssl rand -base64 32) -e BETTER_AUTH_URL=http://localhost:8090 \
    mintsy-api:local
  ```
