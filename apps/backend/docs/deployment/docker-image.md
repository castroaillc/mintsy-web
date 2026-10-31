# Docker image

`apps/backend/Dockerfile` builds the production image. The build context is the **repository root**, because the lockfile and workspace config live there.

```sh
# from the repository root (mintsy-web/)
docker build -f apps/backend/Dockerfile -t mintsy-api:local \
  --build-arg GIT_SHA=$(git rev-parse HEAD) --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) .
```

## Stages

| Stage | What it does |
| --- | --- |
| `base` | `node:24-slim`, Corepack enabled (pnpm from `packageManager`). |
| `build` | Copies the root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` and the backend `package.json`; `pnpm install --frozen-lockfile --filter mintsy-backend...`; copies `tsconfig.json` and `src/`; `pnpm --filter mintsy-backend build`; `pnpm --filter mintsy-backend deploy --prod /out` (production-only `node_modules`). |
| `runtime` | `node:24-slim`, `NODE_ENV=production`, copies `package.json`, `node_modules` and `dist/`; sets `GIT_SHA` / `BUILD_TIME` from build args; runs as `node`; `EXPOSE 8080`; `CMD ["node", "dist/index.js"]`. |

The `GIT_SHA` / `BUILD_TIME` args are declared last so changing them doesn't invalidate the cached layers above. Empty values show as `null` in `/version`.

## Build context

`apps/backend/Dockerfile.dockerignore` is an allowlist: only the root manifests, `apps/backend/package.json`, `apps/backend/tsconfig.json` and `apps/backend/src` enter the context. `apps/web`, `apps/admin`, `node_modules`, `dist`, `docs/` and every `.env*` file stay out.

{% hint style="warning" %}
Keep `dedupePeerDependents: false` in the root `pnpm-workspace.yaml`. Without it, the backend's Better Auth resolves its peer dependencies against `next` / `react` from `apps/web`, and they end up in this image.
{% endhint %}

## Running it locally

Needs local MongoDB (`docker compose up -d` in `apps/backend`).

```sh
docker run -p 8090:8080 -e PORT=8080 \
  -e "MONGODB_URI=mongodb://host.docker.internal:27017/mintsy-test?directConnection=true" \
  -e BETTER_AUTH_SECRET=$(openssl rand -base64 32) -e BETTER_AUTH_URL=http://localhost:8090 \
  mintsy-api:local

curl -s localhost:8090/version
apps/backend/scripts/smoke-test.sh http://localhost:8090
```
