# mintsy admin

Internal content dashboard for mintsy. Staff use it to upload a book PDF, have the
studio pipeline generate episodes, review and edit them, and publish them to the app.

It runs **only on your machine** (`pnpm dev:admin` from the repo root, bound to
`127.0.0.1:3001`) and has **no sign-in**. There is no deployment config, on purpose, and
`pnpm build` refuses to run on Vercel (`scripts/refuse-deploy.mjs`).

It lives in the `mintsy-web` monorepo at `apps/admin`, next to the web app (`apps/web`).

> [!WARNING]
> **Publish goes live in the app immediately.** The dashboard writes straight to the
> MongoDB `books` collection that the backend's GraphQL API serves. Flipping a book or an
> episode to *Published* shows it to every user on their next fetch. Test against a local
> MongoDB, never production.

## How it fits together

```
dashboard ──inserts──▶ studio_jobs ◀──claims/updates── studio worker (studio/: pnpm worker)
    │                                                       │
    └──reads/writes──▶ books ◀──── inserts drafts ──────────┘
                         │
                         └──▶ backend GraphQL (published only) ──▶ mobile app
```

- `books` (db `mintsy`) is the catalog's source of truth. Books and episodes carry
  `status: "draft" | "published"` (missing = published) and `updatedAt`.
- The dashboard only **inserts** jobs (`status: "queued"`, `log: []`, `createdAt`); the
  worker owns them after that.
- Shapes: `.claude/skills/mintsy-contracts/SKILL.md` ("Catalog drafts", "Studio jobs"),
  mirrored in `src/lib/types.ts`.

## Workflow

1. **New book**: pick the PDF and a book id (`^[a-z0-9][a-z0-9-]*$`, unique; it becomes the
   app's book id and can't change). The PDF is saved to `UPLOAD_DIR/<bookId>.pdf` and an
   `ingest` job is queued.
2. **Ingest** (worker) creates the draft book and the chapter list. The book page shows the
   live log.
3. Per chapter: **Generate script** → **Review script** (edit title, summary, takeaways,
   narration, or the raw script.json / scenes.json) → **Render**. A render creates or
   replaces the episode as a **draft**, and sets its title, summary and takeaways from
   script.json.
4. **Metadata** (book page): the category must be one of the app's six chips (`Finance`,
   `Business`, `Psychology`, `Productivity`, `History`, `Health`; `CATEGORIES` in
   `src/lib/schemas.ts`, mirroring the app and studio). A stored book with any other
   category is shown as invalid and can't be saved until you pick one. **Order** sets the
   catalog position: the app features the book with the lowest order on Home and shows the
   highest-order books as "Recently added".
5. **Episode editor**: watch the video, fix text and transcript timing, then **Publish**.
6. **Publish the book** with the toggle on the book page.

Publishing rules (also enforced by the API):

- Episodes go live only as a contiguous run from episode 1: you can publish episode *n*
  only when 1..*n*−1 are published, and unpublish only the highest published one.
- Re-rendering an episode returns it to draft, which hides it and every later episode
  from the app until you publish it again.

## Setup

Needs Node 24+, pnpm, and a MongoDB you can reach locally.

```sh
# from the mintsy-web repo root (one lockfile for both apps)
pnpm install
cp apps/admin/.env.example apps/admin/.env.local   # then edit
```

| Variable | Default | Meaning |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `MONGODB_DB` | `mintsy` | Database holding `books` and `studio_jobs` |
| `MEDIA_BASE_URL` | `https://storage.googleapis.com/mintsy-media` | Public prefix for episode videos and thumbnails (`MEDIA_BASE_URL + "/" + path`) |
| `UPLOAD_DIR` | `apps/admin/uploads` (the app's working directory) | Where PDFs are saved; the worker reads them from here, so it must be on the same machine |

For a throwaway local database:

```sh
docker run -d --name mintsy-admin-mongo -p 127.0.0.1:27018:27017 mongo:7
# MONGODB_URI=mongodb://127.0.0.1:27018
```

## Run

One command runs the dashboard and the studio worker together, both on the admin's
`MONGODB_URI` / `MONGODB_DB` (from `apps/admin/.env.local`, defaults below), so they can't
drift onto different databases. The worker still reads its keys from `studio/.env`.

```sh
pnpm dev:studio      # from the mintsy-web repo root; Ctrl-C stops both
```

Or two terminals, both pointing at the same `MONGODB_URI` / `MONGODB_DB`:

```sh
# 1. dashboard → http://127.0.0.1:3001 (from the mintsy-web repo root)
pnpm dev:admin

# 2. studio worker (processes the queue one job at a time)
cd studio && pnpm worker
```

Workers write a heartbeat to `studio_workers` every 5 seconds. If jobs are queued and no
worker has beaten on the dashboard's database in the last 15 seconds, the dashboard says so
(and names the database). The nav shows which database the dashboard is on.

To try the whole flow without calling Claude, ElevenLabs, Remotion or the bucket, run the
worker in dry-run mode against a local database:

```sh
cd studio && STUDIO_WORKER_DRY_RUN=1 MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=mintsy pnpm worker
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server on 127.0.0.1:3001 (`pnpm dev:admin` from the repo root) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm build` | Production build (checks everything compiles; refuses to run on Vercel) |

## Code map

| Path | What |
|---|---|
| `src/lib/types.ts` | Contract types (`BookDoc`, `EpisodeDoc`, `StudioJob`, results) |
| `src/lib/mongo.ts` | The single MongoDB client |
| `src/lib/schemas.ts` | zod schemas for every write |
| `src/lib/status.ts` | Publish rules (contiguous run from episode 1) |
| `src/lib/catalog.ts`, `src/lib/jobs.ts` | Reads, chapter-state derivation, job inserts |
| `src/app/api/**` | Route handlers for all writes (JSON; PDF upload is multipart) |
| `src/app/**/page.tsx` | Books, New book, Book, Script review, Episode editor, Jobs |

Writes go through route handlers that refuse cross-origin browser requests, since there
is no sign-in.
