# Folder layout

```
apps/backend/
├── .gitbook.yaml            GitBook Git Sync config (root: ./docs/)
├── Dockerfile               Production image; build from the repo root
├── Dockerfile.dockerignore  Allowlist for the root build context
├── docker-compose.yml       Local MongoDB (single-node replica set)
├── .env.example             Every env var name, with comments
├── package.json             Package mintsy-backend, scripts
├── tsconfig.json            NodeNext ESM, strict, src → dist
├── docs/                    This documentation
├── scripts/
│   ├── catalog.json         Legacy bootstrap catalog (9 books)
│   ├── seed-catalog.ts      pnpm seed:catalog (insert-only)
│   └── smoke-test.sh        End-to-end checks against a running server
├── src/
│   ├── index.ts             Express app, middleware order, startup and shutdown
│   ├── env.ts               Reads and validates env vars
│   ├── db.ts                Shared MongoClient and db
│   ├── constants.ts         FREE_EPISODES, PREMIUM_ENTITLEMENT
│   ├── auth.ts              Better Auth config and hooks
│   ├── account.ts           Per-user data deletion, RevenueCat subscriber deletion
│   ├── email.ts             Resend client and branded email template
│   ├── catalog.ts           books / studio_jobs collections, public filtering
│   ├── media.ts             Video and thumbnail URLs, GCS signed URLs
│   ├── search.ts            Catalog search and key ideas (pure functions)
│   ├── saved.ts             My List (saved_items)
│   ├── progress.ts          Watch progress (watch_progress)
│   ├── entitlements.ts      Premium state, RevenueCat REST API
│   ├── revenuecat-webhook.ts POST /webhooks/revenuecat
│   ├── push.ts              Expo push tokens and sending
│   ├── version.ts           GET /version
│   └── graphql/
│       ├── schema.ts        typeDefs and resolvers (one file)
│       └── context.ts       Per-request context (session, Premium)
└── test/                    node:test integration tests (tsx)
```

Imports use ESM with explicit `.js` extensions (`import { db } from "./db.js"`), as required by `"module": "NodeNext"`.

The Docker build context is the repository root, and `Dockerfile.dockerignore` only lets in the root manifests, `apps/backend/package.json`, `tsconfig.json` and `src/`. So `docs/`, `scripts/` and `test/` never reach the image.
