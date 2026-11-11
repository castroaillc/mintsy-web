# Studio pipeline

The studio project (`apps/studio`) turns a book PDF into episode videos. It feeds the catalog by writing to MongoDB directly, not through this API. The admin dashboard drives it through a job queue.

```
admin dashboard ──insert job──▶ studio_jobs ◀──claim / update── studio worker (pnpm worker)
                                                                   │
                                     upload MP4s, HLS + JPG ──▶ gs://mintsy-media
                                     upsert draft book / episode ──▶ books
admin dashboard ──edit, publish──▶ books ──▶ this API (published only) ──▶ app
```

## Jobs (`studio_jobs`)

Owned by studio. The worker creates the index `{ status: 1, createdAt: 1 }` at startup; the backend doesn't touch this collection.

| Kind     | Does                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingest` | Reads the PDF and inserts the book as a draft with no episodes (only if the id is new). Result: book metadata and chapter list.                                                                          |
| `script` | Writes the episode script and scenes for a chapter.                                                                                                                                                      |
| `render` | Voices an episode and renders one video per voice, uploads each voice's MP4 and HLS files and the episode's JPG (content-hashed names) to the media bucket, and upserts the episode into `books` as a draft, including `voices`. Result: `durationSec`, `videoPath`, `thumbnailPath`, `hlsPath`. With `preview: true` it renders locally and writes nothing to the bucket or `books`. |
| `upload` | Uploads the last local render and upserts the draft episode, without rendering again. |
| `cover`  | Renders the book's cover. With `upload: true` it also uploads it and sets `coverPath`, which is live within 60 s (the API's catalog cache) if the book is published. |
| `remaster` | Re-renders an existing episode from its local files and swaps its media, `durationSec`, `transcript` and `voices`. The status stays, so a live episode changes without a publish, within 60 s. |
| `clip` | Renders a vertical social clip on the staff machine. Only reads `books`, and uploads nothing. |

Jobs go `queued` → `running` → `succeeded` / `failed`. Admin inserts them and never changes them afterwards; the worker claims the oldest queued job atomically and runs one at a time.

The full job schema is in [Contracts](../../contracts.md#studio-jobs), owned by studio. Details: [Studio](../../services/studio.md).

## What reaches the app

New books and episodes aren't visible until staff publish them in the admin dashboard: they're drafts, and the public API filters drafts out (see [Catalog model](./)). The exceptions are `remaster` and a `cover` upload, which change a live episode or book without a publish (in the app within 60 s, see [How the API reads it](./#how-the-api-reads-it-and-how-fast-a-publish-shows)). The uploaded media is unlisted (and private once `SIGNED_MEDIA` is on).

## `catalog.json` and studio

Studio may also write `apps/backend/scripts/catalog.json`. That file is only a legacy bootstrap now and `pnpm seed:catalog` never overwrites existing books, so changes to it don't update books already in MongoDB.

Studio's legacy `publish` CLI command still writes that file; the worker writes `books` directly instead.

## If you add a catalog field

1. Add it as optional to `BookDoc` / `EpisodeDoc` in `src/catalog.ts` and expose it in the schema (additively).
2. Tell studio (whether the worker should write it) and admin (whether staff edit it).
3. Say whether `scripts/catalog.json` needs it. Usually not, since it only seeds new databases.
