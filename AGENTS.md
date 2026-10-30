# mintsy-web monorepo

Two separate Next.js apps; read the app's own `AGENTS.md` before changing it.

- `apps/web/`: the web app (app.getmintsy.com). Deployed on Vercel with Root Directory `apps/web`.
- `apps/admin/`: the local-only content dashboard. No auth, never deployed.

Run `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm build` from this root; they cover both apps.
Don't create shared `packages/` without a decision to do so.
