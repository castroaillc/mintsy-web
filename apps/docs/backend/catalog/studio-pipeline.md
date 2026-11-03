# Studio pipeline

The studio project (`apps/studio`) turns a book PDF into episode videos. It feeds the catalog by writing to MongoDB directly, not through this API. The admin dashboard drives it through a job queue.

```
admin dashboard ──insert job──▶ studio_jobs ◀──claim / update── studio worker (pnpm worker)
                                                                   │
                                     upload MP4 + JPG ──▶ gs://mintsy-media
                                     upsert draft book / episode ──▶ books
admin dashboard ──edit, publish──▶ books ──▶ this API (published only) ──▶ app
```

## Jobs (`studio_jobs`)

Owned by studio. The worker creates the index `{ status: 1, createdAt: 1 }` at startup; the backend doesn't touch this collection.

| Kind     | Does                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingest` | Reads the PDF and inserts the book as a draft with no episodes (only if the id is new). Result: book metadata and chapter list.                                                                          |
| `script` | Writes the episode script and scenes for a chapter.                                                                                                                                                      |
| `render` | Voices and renders an episode, uploads the MP4, JPG and HLS files (content-hashed names) to the media bucket, and upserts the episode into `books` as a draft. Result: `durationSec`, `videoPath`, `thumbnailPath`, `hlsPath`. With `preview: true` it renders locally and writes nothing to the bucket or `books`. |
| `upload` | Uploads the last local render and upserts the draft episode, without rendering again. |
| `cover`  | Renders the book's cover. With `upload: true` it also uploads it and sets `coverPath`, which is live at once if the book is published. |

Jobs go `queued` → `running` → `succeeded` / `failed`. Admin inserts them and never changes them afterwards; the worker claims the oldest queued job atomically and runs one at a time.

The full job schema is in [Contracts](../../contracts.md#studio-jobs), owned by studio. Details: [Studio](../../services/studio.md).

## What reaches the app

Nothing the studio writes is visible until staff publish it in the admin dashboard: new books and episodes are drafts, and the public API filters drafts out (see [Catalog model](./)). The uploaded media is unlisted (and private once `SIGNED_MEDIA` is on).

## `catalog.json` and studio

Studio may also write `apps/backend/scripts/catalog.json`. That file is only a legacy bootstrap now and `pnpm seed:catalog` never overwrites existing books, so changes to it don't update books already in MongoDB.

Studio's legacy `publish` CLI command still writes that file; the worker writes `books` directly instead.

## If you add a catalog field

1. Add it as optional to `BookDoc` / `EpisodeDoc` in `src/catalog.ts` and expose it in the schema (additively).
2. Tell studio (whether the worker should write it) and admin (whether staff edit it).
3. Say whether `scripts/catalog.json` needs it. Usually not, since it only seeds new databases.
