# backend

Node + TypeScript + Express 5, Apollo Server (GraphQL), Better Auth (email/password, OpenAPI plugin), MongoDB.

## Setup

```sh
pnpm install
cp .env.example .env          # set BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # local MongoDB (single-node replica set)
pnpm dev
```

## Endpoints

| Path | Description |
| --- | --- |
| `POST /api/auth/sign-up/email` | Register `{ email, password, name }` |
| `POST /api/auth/sign-in/email` | Log in `{ email, password }`; sets the session cookie |
| `POST /api/auth/sign-out` | Log out |
| `GET /api/auth/get-session` | Current session |
| `GET /api/auth/reference` | OpenAPI reference UI for all auth routes |
| `POST /graphql` | GraphQL API (Apollo Sandbox on GET in dev) |
| `GET /health` | Health check |

The GraphQL context carries the Better Auth session (`ctx.session`); see the `me` query in `src/graphql/schema.ts`.

## Notes

- MongoDB must be a replica set (Atlas always is) because Better Auth uses transactions.
- Better Auth is mounted before `express.json()`, which it requires.

## Scripts

`pnpm dev` · `pnpm build` · `pnpm start` · `pnpm typecheck`

## Deploy (production)

Production runs on **Google Cloud Run** (`mintsy-api`, us-central1) at **https://api.getmintsy.com**, with **MongoDB Atlas** (Free cluster, database `mintsy`).

- **Deploys:** every push to `main` triggers Cloud Build, which builds the `Dockerfile` and rolls out a new Cloud Run revision.
- **Config:** plain env vars `BETTER_AUTH_URL=https://api.getmintsy.com`, `MONGODB_DB=mintsy` and `CORS_ORIGINS=` (no web client). Secrets come from Secret Manager: `MONGODB_URI`, `BETTER_AUTH_SECRET` and optionally `EXPO_ACCESS_TOKEN`.
- **Production behavior** (`NODE_ENV=production`, set in the image):
  - The OpenAPI auth reference is disabled.
  - GraphQL introspection and Apollo Sandbox are off.
  - `exp://` dev origins are not trusted.
- **Local image test:**
  ```sh
  docker build -t mintsy-api:local .
  docker run -p 8090:8080 -e PORT=8080 \
    -e "MONGODB_URI=mongodb://host.docker.internal:27017/mintsy-test?directConnection=true" \
    -e BETTER_AUTH_SECRET=$(openssl rand -base64 32) -e BETTER_AUTH_URL=http://localhost:8090 \
    mintsy-api:local
  ```
