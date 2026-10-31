# Local setup

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 24 (the Docker image and CI use `node:24`) | Runtime |
| pnpm | 12.15.0 (pinned in `packageManager`) | Package manager for the whole monorepo |
| Docker + Docker Compose | any recent | Local MongoDB replica set |

`package.json` sets `devEngines.packageManager` with `onFail: "download"`, so pnpm fetches the pinned version itself if yours differs. `corepack enable` also works.

## The monorepo

`mintsy-web` is a pnpm workspace (`pnpm-workspace.yaml`, `packages: apps/*`) with a single lockfile at the repository root. The backend's package name is `mintsy-backend`.

{% hint style="warning" %}
Always install from the repository root. Never create a lockfile inside `apps/backend`.
{% endhint %}

The root `pnpm-workspace.yaml` sets `dedupePeerDependents: false`. Leave it like that: without it, Better Auth's peer dependencies resolve against `next` / `react` from `apps/web`, and they end up in the backend's production image.

## Steps

```sh
# 1. Install (anywhere in the repo; installs the whole workspace)
pnpm install

# 2. Create your env file and set a real secret
cd apps/backend
cp .env.example .env
#    BETTER_AUTH_SECRET: generate with  openssl rand -base64 32

# 3. Start MongoDB (single-node replica set)
docker compose up -d

# 4. Run the API with reload on change
pnpm dev
```

On startup the server prints:

```
Server ready at http://localhost:4000
  GraphQL:  http://localhost:4000/graphql
  Media:    https://storage.googleapis.com/mintsy-media
  Auth API: http://localhost:4000/api/auth/reference
```

It also prints warnings for optional integrations that aren't configured (RevenueCat, Resend, Google, Apple). They're expected locally. See [Environment variables](environment-variables.md).

From the repository root you can run the same thing with `pnpm dev:backend`, or any script with `pnpm --filter mintsy-backend <script>`.

## Local MongoDB

`docker-compose.yml` runs `mongo:8` with `--replSet rs0` on port 27017, with data in the `mongo-data` volume. Its health check runs `rs.initiate(...)` the first time, so the replica set configures itself; give it a few seconds after `docker compose up -d`.

The replica set is required: Better Auth uses MongoDB transactions, which don't work on a standalone server. Atlas is always a replica set.

The default `MONGODB_URI` in `.env.example` is `mongodb://localhost:27017/mintsy?directConnection=true`. The database is `mintsy`, the same name as production and the default of the studio worker and admin dashboard. That way the local API serves what you publish from the local admin.

{% hint style="info" %}
If an older local `.env` still points at the `/backend` database, change it to `/mintsy`. Your old data stays in `backend`; copy it with `mongodump` / `mongorestore --nsFrom 'backend.*' --nsTo 'mintsy.*'` if you need it.
{% endhint %}

## Getting catalog data locally

A fresh local database has no books, so `books` returns `[]`. Either publish content from the admin dashboard (`apps/admin`, `pnpm dev:admin` at the root) or insert the legacy bootstrap catalog with `pnpm seed:catalog`. See [Seeding the catalog](../catalog/seeding.md); check `MONGODB_URI` first.

## Exploring the API

* GraphQL: open `http://localhost:4000/graphql` in a browser for Apollo Sandbox (development only).
* Auth: `http://localhost:4000/api/auth/reference` is an OpenAPI reference for every Better Auth route (development only).
