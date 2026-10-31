# Catalog model

The catalog lives in the `books` collection: one document per book, episodes embedded. **MongoDB is the source of truth.** The studio worker writes draft books and episodes, and staff edit and publish them in the local admin dashboard (`apps/admin`). `scripts/catalog.json` is a legacy bootstrap only (see [Seeding the catalog](seeding.md)).

Document shapes: [MongoDB collections > books](../architecture/mongodb-collections.md#books).

## Who writes what

| Writer | Writes |
| --- | --- |
| Studio worker, `ingest` job | Inserts the book with `status: "draft"` and `episodes: []`, only if its `_id` doesn't exist yet. |
| Studio worker, `render` job | Upserts one episode by `number` with `status: "draft"`, after uploading the MP4 and JPG. A re-render always returns the episode to draft. |
| Admin dashboard | Edits book metadata and episode text, sets `status`, may edit `keyIdeas`. |
| `pnpm seed:catalog` | Inserts books from `catalog.json` that don't exist yet. Never overwrites. |
| This API | Reads only. Never writes `books`. |

## Draft and published

`BookDoc.status` and `EpisodeDoc.status` are `"draft"` or `"published"`. A **missing** status counts as published (documents that predate drafts).

What the public API returns is decided in one place, `publicBook()` in `src/catalog.ts`, used by `listPublishedBooks()` and `getPublishedBook()`:

1. A book with `status: "draft"` is hidden.
2. Episodes are sorted by `number`, then cut to the **contiguous run of published episodes starting at 1**. The first gap or draft ends the run.
3. A book with no episodes left is hidden.

The app indexes `episodes[number - 1]`, which is why the run must start at 1 with no gaps.

Example: episodes 1, 2 published, 3 draft, 4 published → the API returns 1 and 2. Episode 4 appears once 3 is published.

Because of this rule, the admin dashboard only publishes episode n when 1..n-1 are published, and only unpublishes the highest published episode. And a studio re-render of a live episode (back to draft) hides that episode **and every later one** until it's published again.

## Ordering and fields

* `order`: listing order of `books` (ascending, index `{ order: 1 }`). The app shows the lowest as featured and the highest as "Recently added".
* `category`: free text in the backend. The values in use are `Finance`, `Business`, `Psychology`, `Productivity`, `History`, `Health`; the app, studio and admin each keep that list, so change all three together.
* `coverTone`, `tint`: colours for the book's cover and accents.
* `keyIdeas`: optional curated "book in 5 ideas". When missing or empty, `Book.keyIdeas` is derived from the first takeaway of each unlocked episode.
* `videoPath`, `thumbnailPath`: object paths in `gs://mintsy-media`. See [Media and signed URLs](../features/media.md).

## Ids

* Book id = `_id` = the studio's `--book <id>` = studio's `work/<id>/` folder. Lowercase, hyphenated, e.g. `atomic-habits`. Never change it after publishing: My List and watch progress store it.
* Episode id = `<bookId>-<number>`, derived by the API (`Episode.id`), not stored.

## Other places that read `books`

`publicBook()` is also used by `search` (published books only, locked episodes skipped), by watch progress (`setProgress` only accepts published episodes; `continueWatching` and `finishedBookIds` only count published ones), and `setSaved` checks ids against **all** books, drafts included.
