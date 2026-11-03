# mintsy backend

The mintsy backend is the API behind the mintsy iPhone app and the web app at app.getmintsy.com. It serves the book catalog (books made of short video episodes with transcripts), handles accounts and sign-in, tracks Premium subscriptions, saves each user's My List and watch progress, and registers devices for push notifications.

It lives in `apps/backend/` of the `castroaillc/mintsy-web` pnpm monorepo, next to `apps/web` (Next.js web app) and `apps/admin` (local content dashboard).

## Stack

| Piece                   | What it does                                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node + TypeScript (ESM) | Runtime and language. `tsx` in development, `tsc` to `dist/` for production.                                                                                                                                                                                                                                |
| Express 5               | HTTP server and routing.                                                                                                                                                                                                                                                                                    |
| Apollo Server 5         | GraphQL API at `/graphql`.                                                                                                                                                                                                                                                                                  |
| Better Auth             | Accounts, sessions, email/password, Sign in with Google / Apple, at `/api/auth/*`.                                                                                                                                                                                                                          |
| MongoDB                 | One cluster, two databases: `mintsy_app` (the collections the backend owns) and `mintsy_studio` (the ones studio and admin own, including the catalog; read only for the backend). Production stays on the single `mintsy` database until the split. Must be a replica set (Better Auth uses transactions). |
| `expo-server-sdk`       | Expo push notifications.                                                                                                                                                                                                                                                                                    |
| RevenueCat              | Premium subscriptions (webhook + REST API).                                                                                                                                                                                                                                                                 |
| Resend                  | Transactional email (password reset, email change).                                                                                                                                                                                                                                                         |
| Google Cloud Storage    | Episode videos and thumbnails (`gs://mintsy-media`).                                                                                                                                                                                                                                                        |

## Production

|          |                                                                                    |
| -------- | ---------------------------------------------------------------------------------- |
| API      | `https://api.getmintsy.com`                                                        |
| Hosting  | Google Cloud Run service `mintsy-api`, region `us-central1`, project `mintsy-prod` |
| Database | MongoDB Atlas, database `mintsy`                                                   |
| Media    | `gs://mintsy-media`                                                                |

::: danger
Pushing to `main` can deploy production. Read [Deployment](deployment/) before you push or merge anything.
:::

## Where to start

* New to the project: [Local setup](getting-started/local-setup.md)
* Building against the API: [GraphQL API](graphql-api/)
* Signing users in from a client: [Authentication](authentication/)
* Changing the schema: [Changing the schema](graphql-api/changing-the-schema.md)
* Adding books and episodes: [Catalog](catalog/)
