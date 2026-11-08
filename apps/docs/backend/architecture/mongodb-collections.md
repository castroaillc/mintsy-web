# MongoDB collections

The backend uses one shared `MongoClient` (`src/db.ts`) with two database handles:

| Handle      | Database | Env var                                              | Backend access |
| ----------- | -------- | ---------------------------------------------------- | -------------- |
| `db`        | App data | `MONGODB_DB`, else the database in `MONGODB_URI`     | read/write     |
| `catalogDb` | Catalog  | `MONGODB_CATALOG_DB`, else the same database as `db` | **read only**  |

There are two layouts:

* **Single database:** `MONGODB_CATALOG_DB` is unset and every collection, including the studio ones, is in one database. This is the tests (`mintsy-test` / `ci-test`) and production until the split.
* **Split:** `mintsy_app` holds the collections the backend owns, and `mintsy_studio` holds the ones studio and admin own. The backend's production user has readWrite on `mintsy_app` and read on `mintsy_studio`, on one connection string. Studio and admin use a separate user with readWrite on `mintsy_studio` only, so they can't reach user data. See [Splitting the database](../deployment/#splitting-the-database).

Local dev is split as well, with app data in `mintsy` and the catalog in `mintsy_studio` (see `.env.example`), on one local MongoDB with no separate users. See [Local setup](../getting-started/local-setup.md#local-mongodb).

No query crosses the two: the backend uses no `$lookup` or other cross-collection pipeline, and Better Auth's transactions only touch app collections. The code joins them in application code, by id (for example `src/progress.ts`).

MongoDB must be a **replica set**, because Better Auth uses transactions.

Indexes on the app collections are created at startup (`ensure*Indexes()` in `src/index.ts`). **The backend never writes to the catalog database or creates indexes there**; studio owns those indexes.

## Overview

| Collection                                   | Database when split | Owner module                 | Written by                                          | Per user? |
| -------------------------------------------- | ------------------- | ---------------------------- | --------------------------------------------------- | --------- |
| `user`, `session`, `account`, `verification` | `mintsy_app`        | Better Auth (`src/auth.ts`)  | Better Auth                                         | yes       |
| `pushTokens`                                 | `mintsy_app`        | `src/push.ts`                | `registerPushToken`                                 | yes       |
| `entitlements`                               | `mintsy_app`        | `src/entitlements.ts`        | RevenueCat webhook, `refreshPremium`                | yes       |
| `revenueCatEvents`                           | `mintsy_app`        | `src/entitlements.ts`        | RevenueCat webhook                                  | no        |
| `saved_items`                                | `mintsy_app`        | `src/saved.ts`               | `setSaved`                                          | yes       |
| `watch_progress`                             | `mintsy_app`        | `src/progress.ts`            | `setProgress`                                       | yes       |
| `books`                                      | `mintsy_studio`     | `src/catalog.ts` (read only) | studio worker, admin dashboard, `pnpm seed:catalog` | no        |
| `studio_jobs`                                | `mintsy_studio`     | studio (worker)              | admin dashboard, studio worker                      | no        |
| `studio_workers`                             | `mintsy_studio`     | studio (worker)              | studio worker                                       | no        |

Per-user collections are cleared by `deleteUserData()` in `src/account.ts` when an account is deleted (Better Auth deletes its own `user`, `session` and `account` documents; the backend deletes the user's `verification` documents).

## Better Auth: `user`, `session`, `account`, `verification`

Managed entirely by Better Auth's MongoDB adapter. Don't write to them directly. Users are keyed by `ObjectId`; the user id string (`session.user.id`) is what every other collection stores as `userId`, and what RevenueCat uses as `app_user_id`.

* `account` holds sign-in methods: `providerId` is `credential` (password), `google` or `apple`.
* `verification` holds one-time tokens (password reset, email change).

TODO: confirm the exact collection names against a live database. They're Better Auth's default model names; the code only references `user` and `verification` by name.

## `books`

One document per book, with episodes embedded. **MongoDB is the source of truth for the catalog.**

```ts
type ContentStatus = "draft" | "published"; // missing = "published"

interface BookDoc {
  _id: string;          // book id, e.g. "the-science-of-getting-rich"
  title: string;
  author: string;
  category: string;
  coverTone: string;    // colour, e.g. "#E7DFCF"
  tint: string;         // colour, e.g. "#24382F"
  description: string;
  order: number;        // listing position
  episodes: EpisodeDoc[];
  keyIdeas?: string[];  // curated "book in 5 ideas"
  status?: ContentStatus;
  updatedAt?: Date;
}

interface EpisodeDoc {
  number: number;       // 1, 2, 3...
  title: string;
  summary: string;
  durationSec: number;
  transcript: { startSec: number; text: string }[];
  takeaways: string[];
  videoPath?: string;      // object path in the media bucket
  hlsPath?: string;        // HLS master playlist, relative to the media bucket
  thumbnailPath?: string;
  status?: ContentStatus;
  updatedAt?: Date;
}
```

Index: `{ order: 1 }`, created by studio, not by the backend. Without it the listing still works but sorts in memory. See [Catalog model](../catalog/) for publishing rules.

## `studio_jobs`

Job queue between the admin dashboard and the studio worker. The backend has no access path to it. The schema and the index `{ status: 1, createdAt: 1 }` are owned by the studio project; see [Studio pipeline](../catalog/studio-pipeline.md).

## `studio_workers`

One heartbeat document per running studio worker. Owned by the studio project; the backend doesn't use it.

## `pushTokens`

```ts
interface PushTokenDoc { token: string; userId: string; platform: string; updatedAt: Date }
```

Indexes: `{ token: 1 }` unique (a device token belongs to the last user who registered it), `{ userId: 1 }`.

## `entitlements`

One document per user who has ever had a RevenueCat event or refresh. No document = never subscribed.

```ts
interface EntitlementDoc {
  userId: string;
  active: boolean;
  productId: string | null;
  periodType: string | null;     // trial | normal | intro (lowercased)
  expiresAt: Date | null;        // null = lifetime or unknown
  graceExpiresAt?: Date | null;  // billing-issue grace period end
  willRenew: boolean;
  store: string | null;          // app_store, rc_billing, stripe, play_store, promotional, ...
  updatedAt: Date;
  lastEventAtMs?: number;        // newest webhook event applied
}
```

Indexes: `{ userId: 1 }` unique.

## `revenueCatEvents`

Processed webhook event ids, for idempotency: `{ _id: <event id>, type, receivedAt }`. TTL index on `receivedAt`, 90 days.

## `saved_items`

My List.

```ts
interface SavedItemDoc {
  userId: string;
  kind: "book" | "episode";
  id: string;      // book _id, or "<bookId>-<number>"
  savedAt: Date;
}
```

Indexes: `{ userId: 1, kind: 1, id: 1 }` unique, `{ userId: 1, kind: 1, savedAt: -1 }`. At most 500 per user per kind.

## `watch_progress`

```ts
interface WatchProgressDoc {
  userId: string;
  episodeId: string;     // "<bookId>-<number>"
  bookId: string;
  episodeNumber: number;
  positionSec: number;   // clamped to [0, durationSec]
  durationSec: number;   // episode duration at last write
  completed: boolean;
  updatedAt: Date;       // server time of last write
}
```

Indexes: `{ userId: 1, episodeId: 1 }` unique, `{ userId: 1, updatedAt: -1 }`, `{ userId: 1, bookId: 1, episodeNumber: 1 }`.
