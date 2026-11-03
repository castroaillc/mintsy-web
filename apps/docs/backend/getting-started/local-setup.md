# Local setup

## Prerequisites

| Tool                    | Version                                    | Why                                    |
| ----------------------- | ------------------------------------------ | -------------------------------------- |
| Node.js                 | 24 (the Docker image and CI use `node:24`) | Runtime                                |
| pnpm                    | 12.15.0 (pinned in `packageManager`)       | Package manager for the whole monorepo |
| Docker + Docker Compose | any recent                                 | Local MongoDB replica set              |

`package.json` sets `devEngines.packageManager` with `onFail: "download"`, so pnpm fetches the pinned version itself if yours differs. `corepack enable` also works.

## The monorepo

`mintsy-web` is a pnpm workspace (`pnpm-workspace.yaml`, `packages: apps/*`) with a single lockfile at the repository root. The backend's package name is `mintsy-backend`.

::: warning
Always install from the repository root. Never create a lockfile inside `apps/backend`.
:::

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
  Database: mintsy (catalog: mintsy_studio)
  Media:    https://storage.googleapis.com/mintsy-media
  Auth API: http://localhost:4000/api/auth/reference
```

It also prints warnings for optional integrations that aren't configured (RevenueCat, Resend, Google, Apple). They're expected locally. See [Environment variables](environment-variables.md).

From the repository root you can run the same thing with `pnpm dev:backend`, or any script with `pnpm --filter mintsy-backend <script>`.

## Local MongoDB

`docker-compose.yml` runs `mongo:8` with `--replSet rs0` on port 27017, with data in the `mongo-data` volume. Its health check runs `rs.initiate(...)` the first time, so the replica set configures itself; give it a few seconds after `docker compose up -d`.

The replica set is required: Better Auth uses MongoDB transactions, which don't work on a standalone server. Atlas is always a replica set.

`.env.example` uses two databases on this one MongoDB:

* **App data:** `mintsy`, from `MONGODB_URI=mongodb://localhost:27017/mintsy?directConnection=true`.
* **Catalog (`books`):** `mintsy_studio`, from `MONGODB_CATALOG_DB=mintsy_studio`. The studio worker and admin dashboard default to this database, so the local API serves what you publish from the local admin.

Admin and the worker must also be on this MongoDB. Admin's default `MONGODB_URI` is `mongodb://127.0.0.1:27017`, which is this one; the worker has no default, so set it in `studio/.env`. Publishes from a separate throwaway MongoDB, such as the one on port 27018 on the [Admin](../../services/admin.md#setup) page, don't reach the local API.

::: warning
An existing local `.env` needs the same line: add `MONGODB_CATALOG_DB=mintsy_studio` and restart the API. The startup log should say `catalog: mintsy_studio`.

Books already in the local `mintsy` database then won't appear until they're copied or re-created. To copy them, run this from `apps/backend` (books whose id already exists in `mintsy_studio` are left as they are):

```sh
docker compose exec -T mongo sh -c "mongodump --quiet --archive --db=mintsy --collection=books | mongorestore --quiet --archive --nsFrom='mintsy.books' --nsTo='mintsy_studio.books'"
```
:::

::: info
If an older local `.env` still points at the `/backend` database, change it to `/mintsy`. Your old data stays in `backend`; copy it with `mongodump` / `mongorestore --nsFrom 'backend.*' --nsTo 'mintsy.*'` if you need it.
:::

## Getting catalog data locally

A fresh local database has no books, so `books` returns `[]`. Either publish content from the admin dashboard (`apps/admin`, `pnpm dev:admin` at the root) or insert the legacy bootstrap catalog with `pnpm seed:catalog`. See [Seeding the catalog](../catalog/seeding.md); check `MONGODB_URI` first.

## Exploring the API

* GraphQL: open `http://localhost:4000/graphql` in a browser for Apollo Sandbox (development only).
* Auth: `http://localhost:4000/api/auth/reference` is an OpenAPI reference for every Better Auth route (development only).
