# Catalog model

The catalog lives in the `books` collection: one document per book, episodes embedded. **MongoDB is the source of truth.** The studio worker writes draft books and episodes, and staff edit and publish them in the local admin dashboard (`apps/admin`). `scripts/catalog.json` is a legacy bootstrap only (see [Seeding the catalog](seeding.md)).

Document shapes: [MongoDB collections > books](../architecture/mongodb-collections.md#books).

## Who writes what

| Writer                      | Writes                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Studio worker, `ingest` job | Inserts the book with `status: "draft"` and `episodes: []`, only if its `_id` doesn't exist yet.                                          |
| Studio worker, `render` and `upload` jobs | Upserts one episode by `number` with `status: "draft"`, after uploading the media. A re-render returns the episode to draft. |
| Studio worker, `remaster` job | Swaps an existing episode's media, `durationSec`, `transcript` and `voices` in one write. Keeps its status, so a live episode changes without a publish (within 60 s, see below). |
| Admin dashboard             | Edits book metadata and episode text, sets `status`. A transcript edit also goes to the default voice's copy. |
| `pnpm seed:catalog`         | Inserts books from `catalog.json` that don't exist yet. Never overwrites.                                                                 |
| This API                    | Reads only. Never writes `books` or creates indexes in the catalog database (`MONGODB_CATALOG_DB`).                                       |

## Draft and published

`BookDoc.status` and `EpisodeDoc.status` are `"draft"` or `"published"`. A **missing** status counts as published (documents that predate drafts).

What the public API returns is decided in one place, `publicBook()` in `src/catalog.ts`, used by `listPublishedBooks()` and `getPublishedBook()`:

1. A book with `status: "draft"` is hidden.
2. Episodes are sorted by `number`, then cut to the **contiguous run of published episodes starting at 1**. The first gap or draft ends the run.
3. A book with no episodes left is hidden.

The app indexes `episodes[number - 1]`, which is why the run must start at 1 with no gaps.

Example: episodes 1, 2 published, 3 draft, 4 published → the API returns 1 and 2. Episode 4 appears once 3 is published.

Because of this rule, the admin dashboard only publishes episode n when 1..n-1 are published, and only unpublishes the highest published episode. And a studio `render` or `upload` of a live episode (back to draft) hides that episode **and every later one** until it's published again. A `remaster` doesn't.

## Ordering and fields

* `order`: listing order of `books` (ascending, index `{ order: 1 }`). The app shows the lowest as featured and the highest as "Recently added".
* `category`: free text in the backend. The values in use are `Finance`, `Business`, `Psychology`, `Productivity`, `History`, `Health`; the app, studio and admin each keep that list, so change all three together.
* `coverTone`, `tint`: colours for the book's cover and accents.
* `keyIdeas`: optional curated "book in 5 ideas". Curated ideas are trimmed, deduplicated and cut to the first 5, and everyone sees them, like the description. When missing or empty, `Book.keyIdeas` is derived: the first takeaway of each episode the viewer can unlock, in order, deduplicated, first 5. So free viewers get at most 3, and locked takeaways never leak. Studio (generate) and admin (edit) are the intended writers, but neither writes it yet.
* `videoPath`, `hlsPath` (optional), `thumbnailPath`: object paths in `gs://mintsy-media`. See [Media and signed URLs](../features/media.md).
* `voices` (optional): one full render per narrator, left out of every catalog read and served only by `episodeVoices`. Shape and rules: [Episode voices](../../contracts.md#episode-voices).

## Ids

* Book id = `_id` = the studio's `--book <id>` = studio's `work/<id>/` folder. Lowercase, hyphenated, e.g. `atomic-habits`. Never change it after publishing: My List and watch progress store it.
* Episode id = `<bookId>-<number>`, derived by the API (`Episode.id`), not stored.

## Other places that read `books`

`publicBook()` strips `voices`, and `getPublishedEpisodeVoices()` applies the same run of published episodes. `publicBook()` is also used by `search` (published books only, locked episodes skipped), by watch progress (`setProgress` only accepts published episodes; `continueWatching` and `finishedBookIds` only count published ones), and `setSaved` checks ids against **all** books, drafts included.

## How the API reads it, and how fast a publish shows

Reading from the Atlas cluster is slow per byte, not per query. A query costs about one round trip plus roughly 13 ms per KB returned (~80 KB/s per query, measured 2026-11-06 from us-central1 and from outside GCP, with or without wire compression). A published book is ~1 MB stored: ~900 KB of `voices` and ~100 KB of transcripts. Fetching it on every request made almost every app call take ~1.3 s, and `episodeVoices` ~10 s. So `src/catalog.ts`:

* **Loads the published catalog in parallel pieces:** one query for the books and episodes without transcripts or voices, plus up to 8 transcript queries running together (`$slice` over the episodes array, matched back by episode number). The per-query limit means parallel queries finish several times sooner.
* **Keeps it in memory** for up to `CATALOG_CACHE_SECONDS` (default 60). `books`, `book`, `search` and watch progress (`setProgress`, `continueWatching`, `progress`, `finishedBookIds`) all read that one copy. Once a copy is a quarter of that age (15 s), the next read still gets it and starts a refresh in the background. Past the full age, a read waits for a fresh load. One load runs at a time, and a failed load isn't kept.
* **Fetches `episodeVoices` for the one episode asked for** (an aggregation that keeps only that episode's `voices`, ~50 KB), cached the same way, for at most 100 episodes. An episode that isn't in the cached public catalog returns `[]` without a database read.
* **Starts loading at server startup**, as soon as MongoDB is connected, so the first request after a cold start doesn't start its own load.

**Staleness:** a change in admin or studio (publish, unpublish, metadata, a `remaster` or `cover` upload) reaches the API within **60 s**, and within ~15 s on an instance that's serving traffic. Each instance has its own copy, so two instances can disagree for up to that long. Studio never deletes media from the bucket, so URLs from a stale copy keep working. `CATALOG_CACHE_SECONDS=0` turns the cache off, so every read goes to MongoDB. The tests run that way, and it suits local admin work if you want a publish to show at once.

`setSaved` (`catalogHas` in `src/saved.ts`) isn't cached. It's a `countDocuments`, which returns almost nothing.
