# mintsy-web

A pnpm monorepo with two separate Next.js apps and the mintsy API. They share the lockfile and
nothing else.

| App | Path | What it is | Runs where |
|---|---|---|---|
| `mintsy-web` | `apps/web` | The web app at app.getmintsy.com: browse, stream, My List, web checkout | Vercel (deployed) |
| `mintsy-admin` | `apps/admin` | Content dashboard: books, PDF upload, studio jobs, draft/publish | Your machine only |
| `mintsy-backend` | `apps/backend` | GraphQL API + Better Auth (api.getmintsy.com) | Cloud Run; deploys from `castroaillc/mintsy-backend` until cutover |

> [!WARNING]
> **The admin dashboard is local-only and must never be deployed.** It has no sign-in, and
> **Publish goes live in the app immediately**: it writes straight to the MongoDB `books`
> collection that the backend's GraphQL API serves. Test against a local MongoDB, never
> production. Its `build` script refuses to run on Vercel.

## Run

Needs Node 24+ and pnpm (version pinned in `packageManager`).

```sh
pnpm install          # once, at the repo root
pnpm dev:web          # web   → http://localhost:3000
pnpm dev:admin        # admin → http://127.0.0.1:3001 (bound to localhost only)
pnpm dev:backend      # API   → http://localhost:4000 (/graphql, /api/auth/*)
```

The backend needs a local MongoDB replica set: `docker compose -f apps/backend/docker-compose.yml up -d`.

Each app reads its own env file: copy `apps/web/.env.example` to `apps/web/.env.local`,
`apps/admin/.env.example` to `apps/admin/.env.local`, and `apps/backend/.env.example` to
`apps/backend/.env`. See `apps/backend/README.md` for the API, and `apps/admin/README.md` for the admin
workflow and the studio worker.

## Checks

```sh
pnpm lint             # web + admin (the backend has no lint script)
pnpm typecheck        # all three
pnpm build            # all three
pnpm test:backend     # backend tests; need a local replica-set MongoDB (TEST_MONGODB_URI)
```

Run anything for one app with `pnpm --filter mintsy-web <script>`,
`pnpm --filter mintsy-admin <script>` or `pnpm --filter mintsy-backend <script>`.

## Deploying

The web app deploys to Vercel; the backend to Cloud Run.

**Backend:** production still deploys from the standalone `castroaillc/mintsy-backend` repo.
Here, `.github/workflows/backend.yml` runs checks, the Docker image build
(`docker build -f apps/backend/Dockerfile .`, repo-root context) and the smoke test for changes
under `apps/backend/`, but its deploy job is disabled (`if: false`) until this repo exists on
GitHub, the Workload Identity binding trusts it, and the cutover is approved.

**Web:** its Vercel project uses **Root Directory `apps/web`**; Vercel
installs from the workspace root lockfile and builds just that app. There is no Vercel
project for `apps/admin`, and there must never be one.
