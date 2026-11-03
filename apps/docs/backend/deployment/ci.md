# CI

Workflow: `.github/workflows/backend.yml` at the repository root ("Backend CI/CD"). It's owned by the monorepo root, not `apps/backend`.

## Triggers

* Pushes to any branch and pull requests that touch `apps/backend/**` or the workflow file.
* Manual runs (`workflow_dispatch`). With the `preview_ref` input set on a run from `main`, the run also deploys that ref to the preview service. See [Preview deploys](./#preview-deploys).

Superseded runs on the same branch are cancelled, except on `main`, where a deploy is never cancelled mid-way. Preview deploys run one at a time in their own concurrency group, so they can't cancel or replace a production deploy, in progress or queued.

::: warning
The path filter is `apps/backend/**` (leaving out `apps/backend/docs/**` and `apps/backend/.gitbook.yaml`, which no longer exist), so any push to `main` that touches that folder runs the whole workflow, including a production deploy of the current code. That includes `apps/backend/README.md`, so put `[skip ci]` in the subject of a commit that only changes it. These docs live in `apps/docs`, outside that filter, so editing them never deploys.
:::

## Jobs

| Job                                            | Steps                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check` (Typecheck & build)                    | `pnpm install --frozen-lockfile --filter mintsy-backend...` at the root, then `pnpm typecheck` and `pnpm build` in `apps/backend`. Node 24.                                                                                                                                                                                                                |
| `integration` (Docker image + auth smoke test) | Starts MongoDB `mongo:7.0` as a single-node replica set; builds the production image from the root with `GIT_SHA` / `BUILD_TIME`; runs it on port 8080 and checks `/health` and that `/version` reports the commit; runs `scripts/smoke-test.sh http://localhost:8080`; installs and runs `pnpm test` against `ci-test`. Prints container logs on failure. |
| `deploy` (Deploy to Cloud Run)                 | Only on pushes to `main`, after both jobs pass. See [Deployment](./).                                                                                                                                                                                                                                                                                      |
| `deploy-preview` (Deploy to Cloud Run, preview) | Only on a manual run from `main` with `preview_ref` set. Doesn't wait for `check` or `integration`, which test `main` on that run. See [Preview deploys](./#preview-deploys). |
| `smoke-preview` (Smoke test, preview) | After `deploy-preview`. Runs `scripts/smoke-test.sh` from `preview_ref` against the preview service, with `SMOKE_NO_WEB_ORIGIN=1` and no Google credentials. |

CI uses `mongo:7.0` rather than `mongo:8` (local docker compose) because MongoDB 8.0+ refuses to start on Linux kernel 6.19+, which some GitHub runners use.

## Dependabot

`.github/dependabot.yml` (root, whole workspace) opens weekly update PRs for npm packages and GitHub Actions; they go through the same checks.

::: warning
A Dependabot PR that touches `apps/backend` and is merged into `main` deploys production like any other push.
:::

## Reproducing CI locally

```sh
cd apps/backend
pnpm typecheck && pnpm build
docker compose up -d && pnpm test
pnpm dev                                    # then, in another terminal:
scripts/smoke-test.sh http://localhost:4000
```

For the image itself, see [Docker image](docker-image.md).
