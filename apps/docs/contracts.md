# Contracts

What services must agree on. Changing one side means another service has to follow.

## Rules for changing a contract

1. **Additive first.** Add fields as nullable or with defaults. App Store builds keep calling the old schema for weeks.
2. **Order.** The owner ships the new side, consumers adopt it, and the owner removes the old side only after the consumers' release is live.
3. **Write down the exact shape** (types, names, nullability) for whoever picks it up next.
4. **Data collection.** Any new stored field about a user, or a new SDK, needs a privacy policy update (`apps/web/src/app/privacy/page.tsx`), and the owner approves the text.
5. **Per-user data.** Anything new the backend stores about a user must also be deleted in `apps/backend/src/account.ts`.

## Who owns what

Paths starting `apps/` or `packages/` are in `mintsy-web`.

| Contract | Owner | Consumers | Where |
|---|---|---|---|
| GraphQL schema | Backend | Mobile | `apps/backend/src/graphql/schema.ts` ↔ `apps/mobile/src/lib/graphql.ts`, `catalog.tsx`, `src/data/types.ts` |
| Auth (Better Auth, `/api/auth/*`) | Backend | Mobile | `apps/backend/src/auth.ts` ↔ `apps/mobile/src/lib/auth-client.ts`, `deep-links.ts`, `src/app/+native-intent.tsx` |
| Catalog (`books`) | Backend (format, public filtering) | Studio writes drafts, admin edits and publishes | `apps/backend/src/catalog.ts` |
| Studio jobs (`studio_jobs`) | Studio | Admin creates jobs and reads results | `apps/studio/pipeline/jobs.ts` ↔ `apps/admin/src/lib/jobs.ts` |
| Media | Studio | Backend stores paths and issues URLs, mobile streams | `gs://mintsy-media`, `apps/backend/src/media.ts` |
| Free tier (`FREE_EPISODES = 3`) | Backend enforces | Mobile and web read it from `@mintsy/shared` | `apps/backend/src/constants.ts` is a hand-kept copy of the value in `packages/shared/index.js`; the two must match. |
| Book categories | Studio, admin, mobile | | `apps/studio/pipeline/steps/ingest.ts`, `apps/admin/src/lib/schemas.ts`, `apps/mobile/src/data/types.ts`. Change all three together. |
| Premium (RevenueCat) | Backend (entitlements), mobile (purchases) | Web (privacy policy) | `apps/backend/src/entitlements.ts`, `revenuecat-webhook.ts` ↔ `apps/mobile/src/lib/premium.tsx`, `offering.ts` |
| Email (Resend) | Backend | Web (privacy policy) | `apps/backend/src/email.ts` |
| My List | Backend | Mobile | `apps/backend/src/saved.ts` ↔ `apps/mobile/src/lib/saved.tsx` |
| Watch progress | Backend | Mobile | `apps/backend/src/progress.ts` ↔ `apps/mobile/src/lib/progress.tsx` |
| Support contacts | Mobile | Web must serve `/support` | `apps/mobile/src/lib/support.ts` ↔ `apps/web/src/app/support/page.tsx` |
| Brand (`@mintsy/brand`) | `packages/brand` | Mobile, web, admin, studio | `packages/brand/src/tokens.mjs` generates everything. Studio links it from `../../packages/brand`. |
| Free tier, categories, catalog types (`@mintsy/shared`) | `packages/shared` | Mobile, web, admin, studio | `packages/shared/index.js` and `index.d.ts`. Studio links it from `../../packages/shared`. The backend doesn't use it yet: `FREE_EPISODES` in `apps/backend/src/constants.ts` must be kept equal by hand. |
| Book ids | Studio | Backend, mobile | `--book <id>` becomes the catalog `_id` and `work/<id>/` |

## MongoDB

One cluster, two databases. Mobile and web never connect to MongoDB.

| Database | Collections | Access |
|---|---|---|
| `mintsy_app` | `user`, `session`, `account`, `verification`, `pushTokens`, `entitlements`, `revenueCatEvents`, `saved_items`, `watch_progress` | Backend readWrite. Studio and admin have none. |
| `mintsy_studio` | `books`, `studio_jobs`, `studio_workers` | Studio and admin readWrite. Backend read-only. |

- **Backend:** `MONGODB_URI`, `MONGODB_DB` (app) and `MONGODB_CATALOG_DB` (catalog). If the catalog variable is unset, the catalog falls back to the app database, so set it wherever data is split or admin publishes won't reach the app.
- **Studio and admin:** `MONGODB_URI` and `MONGODB_DB`, default `mintsy_studio`. The two must match.
- **Indexes:** the backend never writes to the catalog database at runtime, including `createIndex`. The studio worker creates the `books` and `studio_jobs` indexes.

## Catalog

`BookDoc` and `EpisodeDoc` carry `status?: "draft" | "published"`. A missing status counts as published.

- Public GraphQL returns only books that aren't drafts, and in each only the **contiguous run of published episodes from number 1**, because the app indexes `episodes[number - 1]`. A book with no such episodes is hidden.
- Studio `ingest` inserts a draft book only if the `_id` doesn't exist. `render` upserts one episode by `number` as a draft. Re-rendering always returns an episode to draft, which also hides every later episode until it's published again.
- Admin publishes episode *n* only when 1 to *n*-1 are published, and only unpublishes the highest published episode.
- `order` drives the app's Home: lowest is featured, highest is "Recently added".
- `pnpm seed:catalog` is legacy. It uses `$setOnInsert`, so it can add missing books but never overwrites existing ones.

## Studio jobs

```ts
type JobKind = "ingest" | "script" | "render" | "upload" | "cover";
type JobStatus = "queued" | "running" | "succeeded" | "failed";
interface StudioJob {
  kind: JobKind;
  bookId: string;
  chapter?: number;
  pdfPath?: string;        // ingest: absolute path on this machine
  regenerate?: boolean;    // script: rerun even if files exist
  preview?: boolean;       // render: render locally, no upload
  upload?: boolean;
  scriptJson?: unknown;    // render: edited script to write first
  scenesJson?: unknown;    // render: edited scenes to write first
  status: JobStatus;
  log: string[];           // last 500 lines
  result?: IngestResult | ScriptResult | RenderResult | PreviewResult | CoverResult;
  error?: string;
  createdAt: Date; startedAt?: Date; finishedAt?: Date; workerId?: string;
}
```

`apps/studio/pipeline/jobs.ts` has the exact types.

- **Admin** inserts jobs with `status: "queued"`, `log: []` and a `createdAt` that strictly increases within a batch. It never updates a job. It may delete a book's jobs while they're queued.
- **Worker** (`pnpm worker`) atomically claims the oldest queued job and runs one at a time. A job is either claimed and finishes, or deleted and never runs.
- **Workers table:** each running worker keeps a heartbeat doc in `studio_workers`. Admin treats `lastSeenAt` older than 15 seconds as gone. The doc's `capabilities` list stops admin queuing a job a running worker would mishandle, so bump it when the worker learns a new job feature.
- `STUDIO_WORKER_DRY_RUN=1` produces fake results without calling Claude, Kokoro, Remotion or the bucket.

## Media

- The bucket is `gs://mintsy-media` in project `mintsy-prod`. Studio uploads MP4, JPG and an HLS folder (`<prefix>/master.m3u8`) under content-hashed names.
- The bucket is public today. With backend `SIGNED_MEDIA=true`, it's private and the API returns V4 signed URLs. `SIGNED_MEDIA` isn't set in production.
- URLs come from the API, so clients refetch them rather than store them.
- **HLS:** `Episode.hlsUrl` is null when locked, when there's no `hlsPath`, and always while `SIGNED_MEDIA` is on. Clients stream `hlsUrl ?? videoUrl` and fall back to `videoUrl` on an HLS error. Offline downloads use `videoUrl` only, so the MP4 must keep being uploaded.
- Mobile only asks for `hlsUrl` when `EXPO_PUBLIC_HLS_ENABLED` is exactly `true`. Don't enable it for a build whose API lacks the field, because asking for an unknown field fails the whole request.

## Premium

- Entitlement `premium`, offering `default` with `$rc_annual` and `$rc_monthly`, products `mintsy_premium_monthly` and `mintsy_premium_yearly`. RevenueCat's `app_user_id` is the Better Auth user id.
- `Episode.locked = number > FREE_EPISODES && !viewer.premium.active`, and signed out counts as not Premium. Locked episodes return `videoUrl: null`, `hlsUrl: null`, `transcript: []` and `takeaways: []`.
- `books`, `book(id)` and `search` need no session. A signed-out request gets episodes 1 to `FREE_EPISODES` unlocked, with `videoUrl`. The app's guest mode depends on this: guests browse and play the free episodes without an account (see [Mobile](services/mobile.md#navigation)).
- `POST /webhooks/revenuecat` checks `Authorization` against `REVENUECAT_WEBHOOK_AUTH`, is idempotent by event id and is order-safe by `event_timestamp_ms`. With `REVENUECAT_SECRET_API_KEY` set, it refetches the subscriber from RevenueCat's v1 REST API, so that key must be a v1 `sk_` key.
- The app calls `refreshPremium` after a purchase, restore or entitlement change, then refetches the catalog.

## Account flows

`<scheme>` is `mintsy` (production) or `mintsy-dev` (dev builds), both in the backend's `trustedOrigins`.

- **Sign in with Apple / Google (native):** `signIn.social({ provider, idToken: { token, nonce?, user? }, additionalData?: { appleAuthorizationCode } })`. `additionalData` is optional and Apple only: the app sends Apple's one-time authorization code with the identity token so the backend can store a revocable Apple token. Older builds without it sign in as before. Details: [Apple token revocation](backend/authentication/social-sign-in.md#apple-token-revocation).
- **Password reset:** `requestPasswordReset({ email, redirectTo: <scheme>://reset-password })`, then an emailed link, then `<scheme>://reset-password/?token=<token>`, then `resetPassword({ newPassword, token })`. Links last 1 hour, work once, and the reset revokes every session.
- **Change email:** `changeEmail({ newEmail, callbackURL: <scheme>://email-changed })`. Opening the link never creates a session.
- **Change password:** `changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`.
- **Delete account:** `deleteUser({ password })`. Backend hooks first revoke the user's stored Sign in with Apple tokens at Apple (best effort, never blocks), then delete push tokens, entitlements, saved items, watch progress and verification docs, then call RevenueCat `DELETE /v1/subscribers/{id}`. Store subscriptions aren't cancelled. On iOS, an account with Apple linked confirms deletion by signing in with Apple again, which sends a fresh authorization code, so there's a token to revoke even for accounts that signed in before the app sent one.

## My List and watch progress

- `setSaved(kind, id, saved)` needs a session and is idempotent, with at most 500 saved items per kind. `User.savedBookIds` and `savedEpisodeIds` may include ids no longer in the catalog.
- `setProgress(episodeId, positionSec, completed)` saves the viewer's place. The app calls it about every 10 seconds while playing, and on pause, seek and exit. A position at 95% of the duration or more counts as completed. `User.continueWatching(limit)` reads it back.
- Offline downloads are Premium and stay on the device. Nothing about them reaches the API.
- Daily activity stays on the device (`apps/mobile/src/lib/progress.tsx`).

## Search and key ideas

- `search(query)` is public, returning at most 20 books and 30 episode matches. It's a case-insensitive substring match over published books. Episodes locked for the viewer are skipped, so locked transcript text never leaks.
- `Book.keyIdeas` returns at most 5. It uses `BookDoc.keyIdeas` when set, otherwise the first takeaway of each episode the viewer can unlock.
