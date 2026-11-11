# Overview

The backend is a single Express 5 process (`src/index.ts`) that serves three kinds of traffic:

* **Better Auth** REST routes under `/api/auth/*`: sign-up, sign-in, sessions, account flows.
* **GraphQL** at `/graphql` (Apollo Server 5): catalog, search, the viewer's profile, Premium, My List, watch progress, push tokens.
* A few **plain HTTP routes**: the RevenueCat webhook, `/health` and `/version`. See [HTTP endpoints](http-endpoints.md).

Data is stored in two MongoDB databases on one cluster: `mintsy_app` holds the collections the backend owns (read/write), and `mintsy_studio` holds the ones studio and admin own, including the catalog (read only for the backend). Production stays on the single `mintsy` database until the split. See [MongoDB collections](mongodb-collections.md).

## Who talks to it

| Client                                     | How                                                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone app (`apps/ios`, native Swift)      | Calls the API directly. Keeps the session cookie in a Keychain cookie jar and sends it as a `Cookie` header.                                         |
| Web app (`apps/web`, app.getmintsy.com)    | The browser only talks to app.getmintsy.com. Next.js rewrites `/api/auth/*` and `/graphql` to this API, so cookies are first-party on the web host.  |
| Admin dashboard (`apps/admin`, local only) | Writes the `books` and `studio_jobs` collections directly in MongoDB; it doesn't call this API.                                                      |
| Studio worker (`apps/studio`)              | Writes draft books and episodes to `books` directly, and uploads media to `gs://mintsy-media`. See [Studio pipeline](../catalog/studio-pipeline.md). |
| RevenueCat                                 | Posts subscription events to `/webhooks/revenuecat`; the API also calls RevenueCat's REST API.                                                       |
| Expo push service                          | The API sends push messages through it. No app registers push tokens since the Expo app was retired.                                                |
| Resend                                     | The API sends transactional email through it.                                                                                                        |

See [Authentication > Clients](../authentication/clients.md) for exactly how each client authenticates.

## Startup

`main()` in `src/index.ts`:

1. In parallel: connects the shared `MongoClient` (`src/db.ts`) and then ensures the app database's indexes (`ensurePushIndexes`, `ensureEntitlementIndexes`, `ensureSavedIndexes`, `ensureProgressIndexes`, concurrently), while Apollo Server starts with the drain-HTTP-server plugin. `ensureIndexes()` in `src/db.ts` lists a collection's indexes and creates only missing ones, so a normal start costs one round trip per collection. Nothing is created in the catalog database, which is read-only for the API.
2. As soon as MongoDB is connected, starts loading the published catalog into memory (`warmCatalog()`, see [Catalog model](../catalog/#how-the-api-reads-it-and-how-fast-a-publish-shows)). This doesn't hold up startup. The first catalog request waits for this load instead of starting another.
3. Builds the Express app and middleware (see [Request flow](request-flow.md)) and mounts Apollo at `/graphql`.
4. Listens on `PORT` and logs which optional integrations are missing, plus one `Startup:` line: ms from process start to listening, split into Node boot + imports, MongoDB connect, indexes and Apollo.

The server only listens once MongoDB and Apollo are ready. That's deliberate: Cloud Run's startup probe is a TCP check on the port, and the deploy checks `/health`. A revision that can't reach MongoDB therefore never takes traffic, and no request meets a half-initialised client.

`SIGINT` / `SIGTERM` stop Apollo, close the MongoDB client and exit.

## Key rules that span modules

* **Free tier.** Episodes `1..FREE_EPISODES` (3, `src/constants.ts`) of every book are free. Later episodes are _locked_ for viewers without an active Premium entitlement. Signed-out viewers are never Premium. The apps get the same number from `@mintsy/shared`, which the backend doesn't use yet; change both together.
* **Locked content never leaks.** A locked episode returns `videoUrl: null`, `hlsUrl: null`, `transcript: []`, `takeaways: []`. Search skips locked episodes, `keyIdeas` skips their takeaways, and `setProgress` refuses them.
* **Only published content is public.** `listPublishedBooks()` / `getPublishedBook()` / `publicBook()` in `src/catalog.ts` are the only place public catalog filtering happens. See [Catalog model](../catalog/).
* **Per-user data is deleted with the account.** `deleteUserData()` in `src/account.ts` removes every per-user collection. Anything new that stores per-user data must be added there.
