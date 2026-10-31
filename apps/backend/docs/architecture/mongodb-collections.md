# MongoDB collections

All collections live in one database: `mintsy` in production and in local dev (`mintsy-test` / `ci-test` for tests). The connection is the shared `MongoClient` in `src/db.ts`; `MONGODB_DB` overrides the database name in `MONGODB_URI`.

MongoDB must be a **replica set**, because Better Auth uses transactions.

Indexes are created at startup (`ensure*Indexes()` in `src/index.ts`), so a new database needs no migration step.

## Overview

| Collection | Owner module | Written by | Per user? |
| --- | --- | --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth (`src/auth.ts`) | Better Auth | yes |
| `books` | `src/catalog.ts` | studio worker, admin dashboard, `pnpm seed:catalog` | no |
| `studio_jobs` | studio (worker) | admin dashboard, studio worker | no |
| `pushTokens` | `src/push.ts` | `registerPushToken` | yes |
| `entitlements` | `src/entitlements.ts` | RevenueCat webhook, `refreshPremium` | yes |
| `revenueCatEvents` | `src/entitlements.ts` | RevenueCat webhook | no |
| `saved_items` | `src/saved.ts` | `setSaved` | yes |
| `watch_progress` | `src/progress.ts` | `setProgress` | yes |

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
  _id: string;          // book id, e.g. "psychology-of-money"
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
  thumbnailPath?: string;
  status?: ContentStatus;
  updatedAt?: Date;
}
```

Indexes: `{ order: 1 }`. See [Catalog model](../catalog/README.md) for publishing rules.

## `studio_jobs`

Job queue between the admin dashboard and the studio worker. The backend only creates the index `{ status: 1, createdAt: 1 }` (the worker creates it too) and doesn't read or write jobs. The schema is owned by the studio project; see [Studio pipeline](../catalog/studio-pipeline.md).

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
