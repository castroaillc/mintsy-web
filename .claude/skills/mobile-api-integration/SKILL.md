---
name: mobile-api-integration
description: How the mintsy app talks to the backend (GraphQL fetcher, catalog provider, Better Auth session) and how to adopt a new or changed API field.
---
# Using the API from the app

Paths are relative to `apps/mobile/`.

- `src/lib/graphql.ts`: the minimal `graphql<T>(query, variables)` fetcher, which forwards the Better Auth session cookie. There's no Apollo Client, so don't add one unless asked.
- `src/lib/auth-client.ts`: Better Auth through `@better-auth/expo`.
- `src/lib/catalog-query.ts` and `catalog.tsx`: load the public catalog (`books` with embedded episodes).
- `src/data/types.ts`: the API-facing shapes the UI uses. The free tier, categories and transcript type come from `@mintsy/shared`.

## Adopting an API change

1. Get the exact SDL from the backend's report, or read `apps/backend/src/graphql/schema.ts` (read-only).
2. Update the query where it's issued, then `src/data/types.ts`, keeping nullability identical to the schema.
3. Treat any newly added field as possibly missing, because old backends and cached data exist. Render a sensible fallback.
4. Per-user calls need a signed-in session. Handle `UNAUTHENTICATED` the way existing callers do.
5. To point at a local backend, set the API URL in `.env` (the variable name is in `.env.example`; never print `.env`).
6. Verify with `npx tsc --noEmit && npx expo lint`.
