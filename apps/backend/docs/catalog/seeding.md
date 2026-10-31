# Seeding the catalog

`pnpm seed:catalog` (`scripts/seed-catalog.ts`) loads `scripts/catalog.json` into the `books` collection of whatever database `MONGODB_URI` / `MONGODB_DB` point at.

It's a **legacy bootstrap**: useful to fill a fresh local database, not the way content is published. For each entry it runs `updateOne({ _id: id }, { $setOnInsert: book }, { upsert: true })`, so it:

* inserts books whose id doesn't exist yet;
* **never overwrites** an existing book (editing `catalog.json` doesn't change a book that's already in the database);
* never deletes anything.

It prints `Inserted N new books; left M existing books untouched`.

{% hint style="danger" %}
Never run `pnpm seed:catalog` against production Atlas without explicit approval. Books it inserts go live in the app immediately, with no release, unless they're marked as drafts.
{% endhint %}

## `catalog.json` format

A JSON array of books. Each is a `BookDoc` with `id` instead of `_id`:

```json
[
  {
    "id": "psychology-of-money",
    "title": "The Psychology of Money",
    "author": "Morgan Housel",
    "category": "Finance",
    "coverTone": "#E7DFCF",
    "tint": "#24382F",
    "description": "...",
    "order": 0,
    "episodes": [
      {
        "number": 1,
        "title": "No One’s Crazy",
        "summary": "...",
        "durationSec": 292,
        "transcript": [{ "startSec": 0, "text": "..." }],
        "takeaways": ["..."]
      },
      {
        "number": 4,
        "title": "...",
        "summary": "...",
        "durationSec": 0,
        "transcript": [],
        "takeaways": [],
        "videoPath": "books/psychology-of-money/4.mp4",
        "thumbnailPath": "books/psychology-of-money/4.jpg"
      }
    ]
  }
]
```

(Abbreviated: episodes 2 and 3 are left out of this example; the real file has every episode.)

`videoPath` / `thumbnailPath` are optional (an episode without them has `videoUrl: null`). Entries have no `status`, so seeded books and episodes count as **published**. `keyIdeas` isn't needed.

## Steps

1. **Validate the file:** valid JSON; every episode has `number`, `title`, `summary`, `durationSec`, `transcript` and `takeaways`; `number`s are 1, 2, 3... with no gaps per book (the API hides everything after a gap); ids are lowercase and hyphenated. Episode ids are derived as `<bookId>-<number>`.
2. **Check where `MONGODB_URI` points, without printing secrets.** For example, from `apps/backend/`:
   ```sh
   node --env-file=.env -e 'const u = process.env.MONGODB_URI; console.log(new URL(u.replace(/^mongodb(\+srv)?:/, "http:")).hostname, process.env.MONGODB_DB || "(db from URI)")'
   ```
   `localhost` (docker compose) is fine. An Atlas host (`*.mongodb.net`) is production: **stop and get explicit approval**.
3. **Run it:**
   ```sh
   pnpm seed:catalog
   ```
4. **Check the result** through the API (local: `http://localhost:4000/graphql`, production: `https://api.getmintsy.com/graphql`):
   ```graphql
   { books { id episodes { number title videoUrl thumbnailUrl } } }
   ```
   New episodes with media should have `videoUrl` and `thumbnailUrl`.
5. **Spot-check one video:** `curl -I <videoUrl>` should return `200` and `content-type: video/mp4`.
6. Record which books were inserted and where.

## Current contents

`scripts/catalog.json` has 9 books (83 episodes): `psychology-of-money`, `intelligent-investor`, `rich-dad-poor-dad`, `teach-you-to-be-rich`, `common-sense-investing`, `thinking-fast-and-slow`, `atomic-habits`, `lean-startup`, `deep-work`. Only one episode has media paths (`psychology-of-money` episode 4); the rest would be seeded with `videoUrl: null`.

TODO: confirm whether `catalog.json` should be kept up to date with production, or frozen as a bootstrap snapshot.
