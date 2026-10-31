# Environment variables

Variables are read once at startup in `src/env.ts`, which loads `.env` through `dotenv` (already-set variables win). Copy `.env.example` to `.env` to start. `.env` is gitignored; never commit it.

{% hint style="warning" %}
This page lists names and purposes only. Production secrets live in Google Secret Manager, not in the repository.
{% endhint %}

## Required

The server throws `Missing required env var: <NAME>` at startup when one of these is empty.

| Name | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string. Must point at a replica set. Local default in `.env.example`: the `mintsy` database on `localhost:27017`. |
| `BETTER_AUTH_SECRET` | Secret Better Auth uses to sign sessions and tokens. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Public base URL of this API (`http://localhost:4000` locally, `https://api.getmintsy.com` in production). Fallback base URL for auth links and redirects; its scheme also decides whether cookies get the `__Secure-` prefix. See [Web app](../authentication/clients.md#web-app). |

## Server and database

| Name | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port. Cloud Run sets `8080`. |
| `MONGODB_DB` | database from `MONGODB_URI` | Overrides the database name. Production sets `mintsy`. |
| `CORS_ORIGINS` | empty | Comma-separated extra browser origins, added to both CORS and Better Auth's trusted origins. The web app's origin (`https://app.getmintsy.com`, plus `http://localhost:3000` outside production) is built in, so production sets this empty. |
| `NODE_ENV` | unset (`development`) | `production` (set in the Docker image) turns off the OpenAPI auth reference, Apollo Sandbox and introspection, `exp://` trusted origins, and `http://localhost:3000` as a web origin. |

## Media

| Name | Default | Purpose |
| --- | --- | --- |
| `MEDIA_BASE_URL` | `https://storage.googleapis.com/mintsy-media` | Base URL prepended to episode `videoPath` / `thumbnailPath` when signed media is off. |
| `SIGNED_MEDIA` | off | `true` makes `videoUrl` / `thumbnailUrl` short-lived GCS V4 signed URLs (private bucket). See [Media and signed URLs](../features/media.md). |
| `MEDIA_BUCKET` | `mintsy-media` | Bucket used for signed URLs. |

## Push notifications

| Name | Default | Purpose |
| --- | --- | --- |
| `EXPO_ACCESS_TOKEN` | unset | Only needed if "enhanced push security" is enabled for the Expo project. |

## Premium (RevenueCat)

| Name | Default | Purpose |
| --- | --- | --- |
| `REVENUECAT_WEBHOOK_AUTH` | unset | Exact `Authorization` header value RevenueCat sends to `/webhooks/revenuecat`. Unset = the webhook answers 503. |
| `REVENUECAT_SECRET_API_KEY` | unset | RevenueCat v1 secret key (`sk_...`), server-side only. Enables refetching subscribers from the REST API and deleting them on account deletion. Without it, entitlements come from webhook payloads only. |

## Email (Resend)

| Name | Default | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | unset | Resend API key (`re_...`). Unset = emails are logged to the console instead of sent (an error in production). |
| `EMAIL_FROM` | `mintsy <no-reply@getmintsy.com>` | Sender. Its domain must be verified in Resend. |

## Sign in with Google / Apple

A provider is only enabled when its client ID is set. Leave them empty locally.

| Name | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google web OAuth client ID. Enables Google sign-in. |
| `GOOGLE_IOS_CLIENT_ID` | Comma-separated iOS OAuth client IDs, one per bundle ID. ID tokens with any configured Google client ID as audience are accepted. |
| `GOOGLE_CLIENT_SECRET` | Web client secret. Only for the browser redirect flow (web app). |
| `APPLE_CLIENT_ID` | Apple Services ID. Enables Apple sign-in. |
| `APPLE_CLIENT_SECRET` | ES256 client-secret JWT (expires after at most 6 months). Only for the browser redirect flow. |
| `APPLE_APP_BUNDLE_IDENTIFIER` | Comma-separated bundle IDs accepted as the audience of native ID tokens. Default `com.getmintsy.app,com.getmintsy.app.dev`. |

## Set by the platform or the build

These aren't in `.env.example`; `GET /version` reports them.

| Name | Set by | Purpose |
| --- | --- | --- |
| `GIT_SHA` | Docker build arg | Commit the image was built from. |
| `BUILD_TIME` | Docker build arg | UTC time the image was built. |
| `K_REVISION` | Cloud Run | Running revision name. |

## Tests only

| Name | Default | Purpose |
| --- | --- | --- |
| `TEST_MONGODB_URI` | `mongodb://localhost:27017/mintsy-test?directConnection=true` | Database for `pnpm test`. Non-local hosts are refused. |
