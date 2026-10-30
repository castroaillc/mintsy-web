# mintsy-web monorepo

Two separate Next.js apps and the API; read the app's own `AGENTS.md` / `README.md` before changing it.

- `apps/web/`: the web app (app.getmintsy.com). Deployed on Vercel with Root Directory `apps/web`.
- `apps/admin/`: the local-only content dashboard. No auth, never deployed.
- `apps/backend/` (`mintsy-backend`): the GraphQL API + Better Auth. Cloud Run; production still deploys from
  `castroaillc/mintsy-backend` until cutover, so the deploy job in `.github/workflows/backend.yml` stays `if: false`.
  Its Docker image builds from the repo root: `docker build -f apps/backend/Dockerfile .`.

Run `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm build` from this root; they cover all apps (the backend has no lint script). `pnpm test:backend` runs the backend tests.
Don't create shared `packages/` without a decision to do so.
