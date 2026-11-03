---
name: backend-graphql-change
description: How to add or change a GraphQL type, query or mutation in the mintsy backend without breaking mobile builds already in the App Store.
---
# Changing the GraphQL API

Paths are relative to `apps/backend/`.

1. Read `src/graphql/schema.ts` (typeDefs and resolvers), `src/graphql/context.ts`, the module the resolver calls, and `apps/docs/backend/graphql-api/changing-the-schema.md`.
2. Decide whether the change is **additive** (new type, nullable field, query or mutation) or **breaking** (rename, removal, nullable to non-null, changed argument). Breaking changes need explicit approval in the task, because App Store builds keep calling the old schema for weeks.
3. Edit typeDefs and resolvers together. Give new fields a description string, as existing fields have.
4. Auth: the public catalog needs no session. Per-user data reads the session from context and rejects a missing one the same way the existing resolvers do.
5. New catalog field: update `src/catalog.ts`, and report that studio and admin may need to write it. The catalog lives in `mintsy_studio` and the backend only reads it.
6. Update the matching pages in `apps/docs/backend/graphql-api/`.
7. Verify:
   ```sh
   pnpm typecheck && pnpm build && pnpm test
   docker compose up -d && pnpm dev   # then query it in Apollo Sandbox at /graphql
   ```
8. In your report, paste the final SDL for every changed type and an example query, for whoever updates the mobile app.
