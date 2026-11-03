# mintsy

This repo holds all of mintsy: a pnpm monorepo with every service, the shared packages and the docs.

| Service | Folder | What it owns |
|---|---|---|
| Backend | `apps/backend/` | GraphQL API, auth, push, entitlements, Cloud Run deploys |
| Mobile | `apps/mobile/` | Expo / React Native app, EAS releases. Own lockfile, outside the workspace |
| Web | `apps/web/` | Static site at getmintsy.com: landing, `/privacy`, `/support`. The browse, stream and checkout app is paused in `src/paused-app/` |
| Admin | `apps/admin/` | Local-only Next.js content dashboard (never deployed, port 3001): books, PDF upload, studio jobs, draft and publish |
| Studio | `apps/studio/` | Book PDF to episode video pipeline and its worker. Local-only, own lockfile, outside the workspace |
| Docs | `apps/docs/` | Local-only VitePress site (port 3002): overview, contracts, service pages, backend reference |
| Shared packages | `packages/` | `@mintsy/brand` and `@mintsy/shared` |

**All docs live in `apps/docs/`.** Service folders keep only a `README.md` for getting started, plus design files next to the code that implements them.

`apps/docs/contracts.md` describes every seam between services. Read it before planning anything that crosses one.

## How to work

The main session plans the work, delegates to the agents, and checks the results. It doesn't edit service code itself.

**Agents:** `backend`, `mobile`, `web`, `admin`, `studio` and `docs` (`.claude/agents/`, with skills in `.claude/skills/`). `web` also owns the monorepo root, `.github/` and `packages/`.

1. **Plan.** Work out which services a request touches. A new catalog field, for example, touches backend, studio, admin and mobile.
2. **Brief each agent completely.** Agents start with no memory of the conversation. Give each one the goal, the context and decisions so far, the exact contract shape when one side depends on another, and what "done" means.
3. **Order by contract.** The owner of an interface goes first, and consumers follow with the owner's reported shape in their brief. Independent work runs in parallel.
4. **Check.** Read each report. Make sure verification actually ran and no agent changed anything outside its folder.
5. **Close the loop.** Update `apps/docs/contracts.md` or `apps/docs/overview.md` when a connection changes. When data collection changes, update the privacy policy (`apps/web/src/app/privacy/page.tsx`) and get the user's approval of the text.

### Typical flows
- **New episode:** studio (ingest and render drafts, review the gates), then admin (publish, with approval). `pnpm seed:catalog` and the `publish` step are legacy and aren't part of this.
- **New API feature:** backend (additive schema), then mobile, then docs.
- **Brand change:** `packages/brand`, then each app and studio. Existing videos keep the old look until they're re-rendered.

## Guardrails
- **Pushing, deploying, publishing media, seeding, and EAS build, submit or update always ask first.**
- **Pushes to `main` can deploy production:**
  - Changes under `apps/backend/`, including its `README.md` and `scripts/catalog.json`, or to `.github/workflows/backend.yml` deploy the API to Cloud Run. A `[skip ci]` in the head commit's subject stops that.
  - Changes to `apps/web/`, `packages/`, or the root `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml` redeploy getmintsy.com through Vercel.
  - Changes only under `apps/docs/`, `apps/studio/`, `apps/admin/` or `.claude/` deploy nothing, and EAS is never triggered by a push.
- **Keep the repo name `mintsy-web`:** Cloud Run's deploy permission trusts that exact name.
- **Secrets:** `.env` files aren't readable. Use `.env.example`.
- **Agents** can only write inside their own folder (`.claude/hooks/scope-writes.mjs`), and they can't spawn subagents.
