# mintsy admin

Internal content dashboard for mintsy. Staff use it to upload a book PDF, have the studio pipeline
generate episodes, review and edit them, and publish them to the app.

It runs **only on your machine**, bound to `127.0.0.1:3001`, and has **no sign-in**. There is no
deployment config, on purpose, and `pnpm build` refuses to run on Vercel.

> [!WARNING]
> **Publish goes live in the app immediately.** Test against a local MongoDB, never production.

## Setup

Needs Node 24+, pnpm, and a MongoDB you can reach locally.

```sh
# from the mintsy-web repo root (one lockfile for the workspace)
pnpm install
cp apps/admin/.env.example apps/admin/.env.local   # then edit
```

## Run

```sh
pnpm dev:studio      # from the repo root: dashboard + studio worker on the same database; Ctrl-C stops both
pnpm dev:admin       # or the dashboard alone, with `cd studio && pnpm worker` in a second terminal
```

Checks, from `apps/admin`: `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Documentation

The workflow, env vars, job rules and code map are in the docs:
[`apps/docs/services/admin.md`](../docs/services/admin.md).
