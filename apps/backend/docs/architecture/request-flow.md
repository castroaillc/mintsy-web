# Request flow

Middleware is registered in this order in `src/index.ts`. The order matters.

| # | Mount | What happens |
| --- | --- | --- |
| 1 | `cors(...)` (all routes) | Allows `CORS_ORIGINS` plus the web origins (`https://app.getmintsy.com`, and `http://localhost:3000` outside production), with credentials. Native apps don't send preflights. |
| 2 | `app.all("/api/auth/{*any}", toNodeHandler(auth))` | Better Auth handles every `/api/auth/*` request itself. |
| 3 | `revenueCatWebhook` router | `POST /webhooks/revenuecat` with its own JSON parser (1 MB limit). |
| 4 | `express.json()` | JSON body parsing for everything after this point. |
| 5 | `GET /health` | `{ "status": "ok" }`. |
| 6 | `GET /version` | Build info (`src/version.ts`). |
| 7 | `/graphql` | Apollo Server via `@as-integrations/express5`, with `createContext`. |

{% hint style="warning" %}
Better Auth must be mounted **before** `express.json()`. It reads the raw request body itself; if `express.json()` runs first, auth requests break.
{% endhint %}

## A GraphQL request

```
client ──POST /graphql──▶ cors ─▶ express.json ─▶ Apollo
                                                   │
                         createContext({ req })  ◀─┘
                           auth.api.getSession(headers)   → ctx.session (or null)
                           ctx.viewerPremium()            → lazy, loads entitlement once
                                                   │
                         resolvers (src/graphql/schema.ts)
                           catalog.ts / search.ts / saved.ts / progress.ts
                           entitlements.ts / push.ts / media.ts
                                                   │
                                                MongoDB
```

### Context

`src/graphql/context.ts` builds the context for every operation:

| Field | Meaning |
| --- | --- |
| `session` | Better Auth session (`{ user, session }`) from the request's cookie, or `null` when signed out. |
| `viewerPremium()` | The viewer's `Premium` state. Loaded from `entitlements` at most once per request and cached; signed out = not Premium. |
| `setViewerPremium(p)` | Replaces the cached value; `refreshPremium` uses it so later fields in the same request see the new state. |

### Auth in resolvers

* Public fields (`books`, `book`, `search`, `health`) don't need a session. They still read `viewerPremium()` to decide which episodes are locked.
* Per-user fields call `requireUser(ctx)`, which throws `GraphQLError("Not authenticated")` with `extensions.code = "UNAUTHENTICATED"` when `ctx.session` is null.
* `User` fields also call `viewerOnly()`, which throws `FORBIDDEN` unless the `User` is the viewer. Today `me` and `setSaved` are the only ways to reach a `User`.

## An auth request

`/api/auth/*` goes straight to Better Auth (`src/auth.ts`), which reads and writes the `user`, `session`, `account` and `verification` collections and sets the session cookie. Hooks in `src/auth.ts` add mintsy-specific rules (account deletion, email-change links). See [Authentication](../authentication/README.md).
