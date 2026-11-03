# mintsy-backend (`apps/backend`)

The mintsy API: Node + TypeScript + Express 5, Apollo Server (GraphQL), Better Auth and MongoDB.

Part of the `mintsy-web` pnpm monorepo: one lockfile at the repo root, shared with `apps/web` and
`apps/admin`. Run the commands below from this folder (`apps/backend`), or from the repo root as
`pnpm --filter mintsy-backend <script>` (`pnpm dev:backend`, `pnpm test:backend`).

> Pushes to `main` of `castroaillc/mintsy-web` deploy production, including a change to this README
> alone. Put `[skip ci]` in the subject of a commit that only changes docs.

## Setup

```sh
pnpm install                  # installs the whole workspace (run anywhere in the repo)
cp .env.example .env          # set BETTER_AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # local MongoDB (single-node replica set)
pnpm dev
```

## Scripts

`pnpm dev` · `pnpm build` · `pnpm start` · `pnpm typecheck` · `pnpm test` · `pnpm seed:catalog`

## Documentation

All docs live in [`apps/docs/backend/`](../docs/backend/index.md). When you change the schema, update
`apps/docs/backend/graphql-api/` too.

- [Local setup](../docs/backend/getting-started/local-setup.md)
- [HTTP endpoints](../docs/backend/architecture/http-endpoints.md)
- [GraphQL API](../docs/backend/graphql-api/index.md)
- [Deployment](../docs/backend/deployment/index.md)
- [Media and signed URLs](../docs/backend/features/media.md), including the `SIGNED_MEDIA` IAM setup
