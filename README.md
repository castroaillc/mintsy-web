# mintsy-web

A pnpm monorepo with two separate Next.js apps. They share the lockfile and nothing else.

| App | Path | What it is | Runs where |
|---|---|---|---|
| `mintsy-web` | `apps/web` | The web app at app.getmintsy.com: browse, stream, My List, web checkout | Vercel (deployed) |
| `mintsy-admin` | `apps/admin` | Content dashboard: books, PDF upload, studio jobs, draft/publish | Your machine only |

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
```

Each app reads its own env file: copy `apps/web/.env.example` to `apps/web/.env.local`, and
`apps/admin/.env.example` to `apps/admin/.env.local`. See `apps/admin/README.md` for the admin
workflow and the studio worker.

## Checks

```sh
pnpm lint             # both apps
pnpm typecheck        # both apps
pnpm build            # both apps
```

Run anything for one app with `pnpm --filter mintsy-web <script>` or
`pnpm --filter mintsy-admin <script>`.

## Deploying

Only the web app is deployed. Its Vercel project uses **Root Directory `apps/web`**; Vercel
installs from the workspace root lockfile and builds just that app. There is no Vercel
project for `apps/admin`, and there must never be one.
