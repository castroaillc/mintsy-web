# CI

Workflow: `.github/workflows/backend.yml` at the repository root ("Backend CI/CD"). It's owned by the monorepo root, not `apps/backend`.

## Triggers

* Pushes to any branch and pull requests that touch `apps/backend/**` or the workflow file.
* Manual runs (`workflow_dispatch`).

Superseded runs on the same branch are cancelled, except on `main`, where a deploy is never cancelled mid-way.

{% hint style="warning" %}
The path filter is `apps/backend/**`, which includes `apps/backend/docs/**`. A documentation-only push to `main` runs the whole workflow, including a production deploy of the current code.
{% endhint %}

## Jobs

| Job | Steps |
| --- | --- |
| `check` (Typecheck & build) | `pnpm install --frozen-lockfile --filter mintsy-backend...` at the root, then `pnpm typecheck` and `pnpm build` in `apps/backend`. Node 24. |
| `integration` (Docker image + auth smoke test) | Starts MongoDB `mongo:7.0` as a single-node replica set; builds the production image from the root with `GIT_SHA` / `BUILD_TIME`; runs it on port 8080 and checks `/health` and that `/version` reports the commit; runs `scripts/smoke-test.sh http://localhost:8080`; installs and runs `pnpm test` against `ci-test`. Prints container logs on failure. |
| `deploy` (Deploy to Cloud Run) | Only on pushes to `main`, after both jobs pass. See [Deployment](README.md). |

CI uses `mongo:7.0` rather than `mongo:8` (local docker compose) because MongoDB 8.0+ refuses to start on Linux kernel 6.19+, which some GitHub runners use.

## Dependabot

`.github/dependabot.yml` (root, whole workspace) opens weekly update PRs for npm packages and GitHub Actions; they go through the same checks.

{% hint style="warning" %}
A Dependabot PR that touches `apps/backend` and is merged into `main` deploys production like any other push.
{% endhint %}

## Reproducing CI locally

```sh
cd apps/backend
pnpm typecheck && pnpm build
docker compose up -d && pnpm test
pnpm dev                                    # then, in another terminal:
scripts/smoke-test.sh http://localhost:4000
```

For the image itself, see [Docker image](docker-image.md).
