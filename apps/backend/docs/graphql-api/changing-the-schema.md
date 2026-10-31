# Changing the schema

The GraphQL schema is a contract with the mobile app. The App Store build in people's hands keeps calling the old schema for weeks after a release, so a breaking change here breaks real users, and there's nothing the app can do about it until they update.

{% hint style="danger" %}
**Additive changes only**, unless a breaking change has been explicitly approved. Never rename or remove a field, make a nullable field non-null, add a required argument, or change an argument's type in one step.
{% endhint %}

## Additive vs. breaking

| Change | Kind |
| --- | --- |
| New type, enum or input | additive |
| New query or mutation | additive |
| New **nullable** field, or a non-null field that always has a value (e.g. a list that may be empty) | additive |
| New **optional** argument (nullable, or with a default) | additive |
| New enum value | additive for inputs; for outputs, check the app handles unknown values |
| Rename or remove a field, type, argument or enum value | **breaking** |
| Nullable → non-null on an *argument*, or a new required argument | **breaking** |
| Non-null → nullable on an *output* field | **breaking** (old clients may not handle `null`) |
| Change a field's or argument's type | **breaking** |
| Change what a field means (units, id format) | **breaking**, even though the schema looks the same |

## Replacing something: add, adopt, remove

1. **Backend** adds the new field alongside the old one and marks the old one deprecated:
   ```graphql
   oldField: String @deprecated(reason: "Use newField")
   ```
2. **Mobile** (and the web app) adopt the new field and ship a release.
3. **Backend** removes the old field only after that release is live and the old builds are no longer in meaningful use.

## Steps

1. Read `src/graphql/schema.ts` (typeDefs and resolvers in one file), `src/graphql/context.ts`, and the module the resolver will call (`src/catalog.ts`, `src/push.ts`, `src/auth.ts`, ...).
2. Decide whether the change is additive or breaking (table above).
3. Edit `typeDefs` and `resolvers` together. Document every new field with a `"description string"`, the way existing fields are. Descriptions are what client developers see in Sandbox.
4. Auth:
   * Public data (the catalog) needs no session.
   * Anything per-user calls `requireUser(ctx)`, which throws `GraphQLError` with `extensions: { code: "UNAUTHENTICATED" }` when `ctx.session` is missing. `User` fields also call `viewerOnly()`.
   * Anything that exposes episode content must respect locking (`isLocked` / `lockCheck` in `schema.ts`): locked episodes must not leak video, transcript or takeaways.
5. Catalog fields come from the `books` documents. If you add one, update `BookDoc` / `EpisodeDoc` and any mapping in `src/catalog.ts`, make the field optional (old documents won't have it), and say whether the studio worker, the admin dashboard and `scripts/catalog.json` need to write it.
6. New per-user data: add its deletion to `deleteUserData()` in `src/account.ts`, and flag it for the privacy policy (data-collection change).
7. Verify:
   ```sh
   pnpm typecheck && pnpm build
   docker compose up -d && pnpm dev   # then query it in Apollo Sandbox at http://localhost:4000/graphql
   ```
   For auth or route changes, also run `scripts/smoke-test.sh http://localhost:4000` (local only: it creates a throwaway user).
8. Hand off to the mobile side with the final SDL of every changed type and an example query.

## Update these docs

* Update [Types](types.md), [Queries](queries.md) or [Mutations](mutations.md) by hand.
* Regenerate [Full SDL](full-sdl.md). From `apps/backend/`, this prints the schema without connecting to a database or reading `.env`:

```sh
DOTENV_CONFIG_PATH=/dev/null MONGODB_URI=mongodb://127.0.0.1:1/x BETTER_AUTH_SECRET=x BETTER_AUTH_URL=http://localhost:4000 \
  pnpm exec tsx -e 'Promise.all([import("./src/graphql/schema.ts"), import("graphql")]).then(([s, g]) => { console.log(g.printSchema(g.buildSchema(s.typeDefs))); process.exit(0); })' 2>/dev/null
```

Paste the output into the code block on the Full SDL page.

## Who else is affected

| Change | Tell |
| --- | --- |
| Any schema change | mobile (`mobile-app/src/lib/graphql.ts`, `src/lib/catalog.tsx`, `src/data/types.ts`) and the web app |
| New catalog field | studio (writes drafts), admin (edits) |
| `FREE_EPISODES` | mobile mirrors it in `src/data/types.ts`; change both together |
| New stored per-user data | landing (privacy policy) |
