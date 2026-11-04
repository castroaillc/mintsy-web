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
| GraphQL schema | Backend | Mobile | `apps/backend/src/graphql/schema.ts` ↔ `apps/mobile/src/lib/graphql.ts`, `catalog.tsx`, `voices.ts`, `src/data/types.ts` |
| Auth (Better Auth, `/api/auth/*`) | Backend | Mobile | `apps/backend/src/auth.ts` ↔ `apps/mobile/src/lib/auth-client.ts`, `deep-links.ts`, `src/app/+native-intent.tsx` |
| Catalog (`books`) | Backend (format, public filtering) | Studio writes drafts and swaps media, admin edits and publishes | `apps/backend/src/catalog.ts`, `apps/studio/pipeline/voices.ts` (checks `voices` before writing), `packages/shared/index.d.ts` |
| Studio jobs (`studio_jobs`) | Studio | Admin creates jobs and reads results | `apps/studio/pipeline/jobs.ts` ↔ `apps/admin/src/lib/jobs.ts` |
| Media | Studio | Backend stores paths and issues URLs, mobile streams | `gs://mintsy-media`, `apps/backend/src/media.ts` |
| Free tier (`FREE_EPISODES = 3`) | Backend enforces | Mobile and web read it from `@mintsy/shared` | `apps/backend/src/constants.ts` is a hand-kept copy of the value in `packages/shared/index.js`; the two must match. |
| Book categories | Studio, admin, mobile | | `apps/studio/pipeline/steps/ingest.ts`, `apps/admin/src/lib/schemas.ts`, `apps/mobile/src/data/types.ts`. Change all three together. |
| Premium (RevenueCat) | Backend (entitlements), mobile (purchases) | Web (privacy policy) | `apps/backend/src/entitlements.ts`, `revenuecat-webhook.ts` ↔ `apps/mobile/src/lib/premium.tsx`, `offering.ts` |
| Email (Resend) | Backend | Web (privacy policy) | `apps/backend/src/email.ts` |
| My List | Backend | Mobile | `apps/backend/src/saved.ts` ↔ `apps/mobile/src/lib/saved.tsx` |
| Watch progress | Backend | Mobile | `apps/backend/src/progress.ts` ↔ `apps/mobile/src/lib/progress.tsx`, `voices.ts` |
| Observe (performance data and native crash reports sent to Expo) | Mobile | Web (privacy policy) | `apps/mobile/src/app/_layout.tsx`, using `expo-observe`. What it sends: [Observe](services/mobile.md#observe) |
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
- Studio `ingest` inserts a draft book only if the `_id` doesn't exist. `render` and `upload` upsert one episode by `number` as a draft, which also hides every later episode until it's published again. `remaster` doesn't: it swaps the media in place and keeps the status.
- Admin publishes episode *n* only when 1 to *n*-1 are published, and only unpublishes the highest published episode.
- `order` drives the app's Home: lowest is featured, highest is "Recently added".
- `pnpm seed:catalog` is legacy. It uses `$setOnInsert`, so it can add missing books but never overwrites existing ones.

- **Whole seconds:** `durationSec` and `transcript[].startSec` are `Int!` in GraphQL, at the top level and in `voices[]`. A fractional value fails the response rather than one field: `books` and `episodeVoices` return no data, and `book(id)` returns null. A locked episode's transcript isn't resolved, so it can't trigger this, but its `durationSec` can. Two checks keep bad values out, because the backend validates nothing:
  - **Studio:** `checkEpisodeVoices` (`apps/studio/pipeline/voices.ts`) refuses a non-whole top-level `durationSec` or transcript line before writing, including when `voices` is empty.
  - **Admin:** refuses to publish a run containing values the API can't serve, on the episode and book status routes. See [Publishing rules](services/admin.md#publishing-rules).

## Episode voices

An episode can have one full render per narrator. The top-level `videoPath`, `hlsPath`, `durationSec` and `transcript` always describe the default voice, so older app builds keep working.

::: info Not live yet
As of 2026-11-03 the backend with `episodeVoices` isn't deployed, no production episode has `voices`, and the backfill hasn't run.
:::

```ts
interface EpisodeDoc {
  // ...the existing fields
  voices?: EpisodeVoiceDoc[];
}
interface EpisodeVoiceDoc {
  id: string;              // "af_heart"
  name: string;            // "Heart"
  isDefault: boolean;
  videoPath: string;
  hlsPath?: string;
  durationSec: number;     // whole seconds
  transcript: { startSec: number; text: string }[];       // startSec in whole seconds
  captions: { startSec: number; endSec: number; text: string }[];  // seconds may be fractional
}
```

```graphql
episodeVoices(episodeId: ID!): [EpisodeVoice!]!
```

The types are in the [Full SDL](backend/graphql-api/full-sdl.md).

- **Separate from the catalog on purpose.** Timed text for every voice would bloat `booksQuery`, so every catalog read excludes `episodes.voices` (`catalogProjection` in `apps/backend/src/catalog.ts`).
- **`[]` means locked, not public, unknown or legacy,** and these look the same. The query works signed out, with the same lock and publishing rules as the catalog.
- **Rules for `voices[]`.** The backend doesn't validate it, so studio checks all of this before it writes (`checkEpisodeVoices` in `apps/studio/pipeline/voices.ts`):
  - `durationSec` and `transcript[].startSec` are whole seconds. A fractional value fails that episode's whole `episodeVoices` response.
  - Exactly one voice is the default, and it comes first. It must match the top-level `videoPath`, `hlsPath`, `durationSec` and `transcript`.
  - Every voice has the same number of transcript lines, because the app converts positions by matching lines.
  - Voice ids and `videoPath`s are different for each voice.
- **Writes.** `render` and `upload` always write `voices`, with `[]` for an episode voiced before Kokoro. `remaster` needs at least one voice.
- **Admin transcript edits** write the top-level and default-voice copies in one update. The other voices and every voice's `captions` stay as they are. The line count is fixed on episodes with voices.

### Order for the backfill

`remaster` swaps live media immediately, and remastered episodes have no burned captions. So the backfill must wait until an app release with the captions UI is live. Older builds lose captions on remastered episodes, leaving only their transcript overlay, which is off by default. The same applies to any episode newly rendered and published before that release.

## Studio jobs

```ts
type JobKind = "ingest" | "script" | "render" | "upload" | "cover" | "remaster" | "clip";
type JobStatus = "queued" | "running" | "succeeded" | "failed";
interface StudioJob {
  kind: JobKind;
  bookId: string;
  chapter?: number;
  pdfPath?: string;        // ingest: absolute path on this machine
  regenerate?: boolean;    // script: rerun even if files exist
  preview?: boolean;       // render: render locally, no upload
  upload?: boolean;        // cover: also upload it
  overwriteTranscript?: boolean;  // remaster: replace differing transcript text in books
  voice?: string;          // clip: voice id, default the episode's default voice
  startScene?: number;     // clip: first scene, 1-based, default 1
  endScene?: number;       // clip: last scene, inclusive, default the fewest scenes reaching the minimum length
  scriptJson?: unknown;    // render: edited script to write first
  scenesJson?: unknown;    // render: edited scenes to write first
  status: JobStatus;
  log: string[];           // last 500 lines
  result?: IngestResult | ScriptResult | RenderResult | RemasterResult | PreviewResult | CoverResult | ClipJobResult;
  error?: string;
  createdAt: Date; startedAt?: Date; finishedAt?: Date; workerId?: string;
}
```

`apps/studio/pipeline/jobs.ts` has the exact types. The two new results:

```ts
interface RemasterResult {
  durationSec: number; videoPath: string; thumbnailPath: string; hlsPath: string;
  voices: string[];                // voice ids now on the episode, default first
  transcriptLinesChanged: number;  // above 0 only with overwriteTranscript
}
interface ClipJobResult {
  videoPath: string; thumbnailPath: string;  // relative to the episode folder
  voice: string;                   // voice id, or "voice" for an episode voiced before Kokoro
  startScene: number; endScene: number;
  durationSec: number;             // the finished clip, end card included
  width: number; height: number;
  episodePublished: boolean;       // whether the app showed the episode when the clip was rendered
}
```

- **`remaster`** re-renders an existing episode from its local files and swaps its media, `durationSec`, `transcript` and `voices` in one write. It keeps the status, title, summary and takeaways, so a live episode stays live and changes at once. It refuses when transcript text in `books` differs, unless `overwriteTranscript` is set.
- **`clip`** renders a vertical clip locally. It only reads `books` and never touches the bucket. Only the free episodes can have clips.

- **Admin** inserts jobs with `status: "queued"`, `log: []` and a `createdAt` that strictly increases within a batch. It never updates a job. It may delete a book's jobs while they're queued.
- **Worker** (`pnpm worker`) atomically claims the oldest queued job and runs one at a time. A job is either claimed and finishes, or deleted and never runs.
- **Workers table:** each running worker keeps a heartbeat doc in `studio_workers`. Admin treats `lastSeenAt` older than 15 seconds as gone. The doc's `capabilities` list stops admin queuing a job a running worker would mishandle, so bump it when the worker learns a new job feature. Today it's `render-preview`, `upload`, `cover`, `remaster` and `clip`.
- `STUDIO_WORKER_DRY_RUN=1` produces fake results without calling Claude, Kokoro, Remotion or the bucket.

## Media

- The bucket is `gs://mintsy-media` in project `mintsy-prod`. Studio uploads MP4, JPG and an HLS folder (`<prefix>/master.m3u8`) under content-hashed names. Each voice has its own MP4 and HLS prefix. An episode has one JPG, under the default voice's prefix.
- **Local layout** (`work/<book>/ep-NN/`): the default voice stays at `episode.mp4`, `hls/` and `props.json`. Other voices are at `renders/kokoro-<voice>/`. Clips are at `clips/`, and clips never reach the bucket.
- **Captions:** episodes no longer have burned captions after a re-render, because the app draws them from `voices[].captions`. Clips do have them. Video already in the bucket keeps its captions until it's replaced.
- The bucket is public today. With backend `SIGNED_MEDIA=true`, it's private and the API returns V4 signed URLs. `SIGNED_MEDIA` isn't set in production.
- URLs come from the API, so clients refetch them rather than store them.
- **HLS:** `Episode.hlsUrl` is null when locked, when there's no `hlsPath`, and always while `SIGNED_MEDIA` is on. Clients stream `hlsUrl ?? videoUrl` and fall back to `videoUrl` on an HLS error. Offline downloads use `videoUrl` only, so the MP4 must keep being uploaded.
- Mobile only asks for `hlsUrl` when `EXPO_PUBLIC_HLS_ENABLED` is exactly `true`. Don't enable it for a build whose API lacks the field, because asking for an unknown field fails the whole request.

## Premium

- Entitlement `premium`, offering `default` with `$rc_annual` and `$rc_monthly`, products `mintsy_premium_monthly` and `mintsy_premium_yearly`. RevenueCat's `app_user_id` is the Better Auth user id.
- `Episode.locked = number > FREE_EPISODES && !viewer.premium.active`, and signed out counts as not Premium. Locked episodes return `videoUrl: null`, `hlsUrl: null`, `transcript: []` and `takeaways: []`.
- `POST /webhooks/revenuecat` checks `Authorization` against `REVENUECAT_WEBHOOK_AUTH`, is idempotent by event id and is order-safe by `event_timestamp_ms`. With `REVENUECAT_SECRET_API_KEY` set, it refetches the subscriber from RevenueCat's v1 REST API, so that key must be a v1 `sk_` key.
- The app calls `refreshPremium` after a purchase, restore or entitlement change, then refetches the catalog.

## Account flows

`<scheme>` is `mintsy` (production) or `mintsy-dev` (dev builds), both in the backend's `trustedOrigins`.

- **Password reset:** `requestPasswordReset({ email, redirectTo: <scheme>://reset-password })`, then an emailed link, then `<scheme>://reset-password/?token=<token>`, then `resetPassword({ newPassword, token })`. Links last 1 hour, work once, and the reset revokes every session.
- **Change email:** `changeEmail({ newEmail, callbackURL: <scheme>://email-changed })`. Opening the link never creates a session.
- **Change password:** `changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`.
- **Delete account:** `deleteUser({ password })`. Backend hooks delete push tokens, entitlements, saved items, watch progress and verification docs, then call RevenueCat `DELETE /v1/subscribers/{id}`. Store subscriptions aren't cancelled.

## My List and watch progress

- `setSaved(kind, id, saved)` needs a session and is idempotent, with at most 500 saved items per kind. `User.savedBookIds` and `savedEpisodeIds` may include ids no longer in the catalog.
- `setProgress(episodeId, positionSec, completed)` saves the viewer's place. The app calls it about every 10 seconds while playing, and on pause, seek and exit. A position at 95% of the duration or more counts as completed. `User.continueWatching(limit)` reads it back.
- `positionSec` always stays on the default voice's timeline, whichever voice is playing. The app converts by matching transcript lines (`apps/mobile/src/lib/voices.ts`).
- Offline downloads are Premium and stay on the device. Nothing about them reaches the API.
- Daily activity stays on the device (`apps/mobile/src/lib/progress.tsx`).

## Search and key ideas

- `search(query)` is public, returning at most 20 books and 30 episode matches. It's a case-insensitive substring match over published books. Episodes locked for the viewer are skipped, so locked transcript text never leaks.
- `Book.keyIdeas` returns at most 5. It uses `BookDoc.keyIdeas` when set, otherwise the first takeaway of each episode the viewer can unlock.
