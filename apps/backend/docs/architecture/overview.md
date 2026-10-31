# Overview

The backend is a single Express 5 process (`src/index.ts`) that serves three kinds of traffic:

* **Better Auth** REST routes under `/api/auth/*`: sign-up, sign-in, sessions, account flows.
* **GraphQL** at `/graphql` (Apollo Server 5): catalog, search, the viewer's profile, Premium, My List, watch progress, push tokens.
* A few **plain HTTP routes**: the RevenueCat webhook, `/health` and `/version`. See [HTTP endpoints](http-endpoints.md).

Everything is stored in one MongoDB database (`mintsy`). See [MongoDB collections](mongodb-collections.md).

## Who talks to it

| Client | How |
| --- | --- |
| iPhone app (`mobile-app`, Expo) | Calls `https://api.getmintsy.com` directly. Better Auth Expo client keeps the session cookie in SecureStore and sends it as a `Cookie` header. |
| Web app (`apps/web`, app.getmintsy.com) | The browser only talks to app.getmintsy.com. Next.js rewrites `/api/auth/*` and `/graphql` to this API, so cookies are first-party on the web host. |
| Admin dashboard (`apps/admin`, local only) | Writes the `books` and `studio_jobs` collections directly in MongoDB; it doesn't call this API. |
| Studio worker (`studio`) | Writes draft books and episodes to `books` directly, and uploads media to `gs://mintsy-media`. See [Studio pipeline](../catalog/studio-pipeline.md). |
| RevenueCat | Posts subscription events to `/webhooks/revenuecat`; the API also calls RevenueCat's REST API. |
| Expo push service | The API sends push messages through it. |
| Resend | The API sends transactional email through it. |

See [Authentication > Clients](../authentication/clients.md) for exactly how each client authenticates.

## Startup

`main()` in `src/index.ts`:

1. Connects the shared `MongoClient` (`src/db.ts`).
2. Creates indexes: `ensurePushIndexes`, `ensureCatalogIndexes`, `ensureEntitlementIndexes`, `ensureSavedIndexes`, `ensureProgressIndexes`.
3. Builds the Express app and middleware (see [Request flow](request-flow.md)).
4. Starts Apollo Server with the drain-HTTP-server plugin and mounts it at `/graphql`.
5. Listens on `PORT` and logs which optional integrations are missing.

`SIGINT` / `SIGTERM` stop Apollo, close the MongoDB client and exit.

## Key rules that span modules

* **Free tier.** Episodes `1..FREE_EPISODES` (3, `src/constants.ts`) of every book are free. Later episodes are *locked* for viewers without an active Premium entitlement. Signed-out viewers are never Premium. The mobile app mirrors this constant; change both together.
* **Locked content never leaks.** A locked episode returns `videoUrl: null`, `transcript: []`, `takeaways: []`. Search skips locked episodes, `keyIdeas` skips their takeaways, and `setProgress` refuses them.
* **Only published content is public.** `listPublishedBooks()` / `getPublishedBook()` / `publicBook()` in `src/catalog.ts` are the only place public catalog filtering happens. See [Catalog model](../catalog/README.md).
* **Per-user data is deleted with the account.** `deleteUserData()` in `src/account.ts` removes every per-user collection. Anything new that stores per-user data must be added there.
