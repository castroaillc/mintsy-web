# studio

Turns a book PDF into mintsy episodes: one ~5-minute narrated, animated video per chapter.

```
book.pdf ─ingest─▶ book.json (metadata + chapter pages)
                     │
   episode ─▶ chapter.txt ─▶ script.json ─▶ scenes.json ─▶ voice.json + audio/ ─▶ episode.mp4 + thumbnail.jpg
              (pages)        (Claude)       (Claude)       (Kokoro, local)         (Remotion)
                                                                                      │
   upload (encodes HLS) ─▶ gs://mintsy-media + draft episode in MongoDB `books` ◀────────────────────┘
```

Staff run this from the admin dashboard (`mintsy-admin/`): it queues jobs in MongoDB and `pnpm worker` here runs them. MongoDB `books` is the catalog's source of truth; the worker writes **drafts** and staff publish them in the dashboard. The CLI below still works for hand runs.

| Step | What it does | Output (in `work/<book>/ep-<nn>/`) |
|---|---|---|
| `ingest` | Extracts text per page; Claude reads the book once for title, author, category, colors and chapter page ranges | `work/<book>/book.json`, `pages.json` |
| `chapter` | Cuts the chapter's pages out | `chapter.txt` |
| `script` | Claude writes ~700 words of narration, a one-line summary and 3 takeaways | `script.json` |
| `scenes` | Claude splits the narration into 10–16 scenes and picks a visual template for each, with cue phrases that time on-screen items to the voice | `scenes.json` |
| `voice` | Kokoro narrates each scene locally, in every voice in `KOKORO_VOICES`, with word timestamps; cue times and per-sentence transcript lines come from those. The first voice is the one rendered | `audio/kokoro-<voice>/*.mp3`, `voices/`, `voice.json` |
| `render` | Remotion renders 1280×720 H.264 (faststart) and a thumbnail | `episode.mp4`, `thumbnail.jpg` |
| upload (worker `render` and `upload` jobs) | Encodes `episode.mp4` to HLS with local ffmpeg (`pipeline/transcode.sh`: 1080p/720p/360p H.264 + AAC fMP4, no upscaling, aligned 6s keyframes), uploads to the media bucket under a content-hashed name (`books/<book>/<chapter>-<hash8>.mp4/.jpg` and `books/<book>/<chapter>-<hash8>/master.m3u8` + `stream_N/`, `master.m3u8` last; `Cache-Control: private, max-age=31536000`; the bucket may be private, with the backend issuing signed URLs) and upserts the episode (title, summary, takeaways, transcript, duration, paths) into `books` as a draft. Any encode or upload failure fails the job and saves nothing. The MP4 stays: offline downloads and existing app builds use it | `hls/` |
| `publish` (legacy CLI) | Same encode and upload, but writes the episode into `mintsy-web/apps/backend/scripts/catalog.json` instead of MongoDB | — |

## Setup

```sh
pnpm install
cp .env.example .env     # everything in it is optional except MONGODB_URI for the worker
ant auth login           # or set ANTHROPIC_API_KEY in .env
brew install uv espeak-ng ffmpeg
(cd tts && uv sync)      # required: the Kokoro narration environment, about 1 GB with PyTorch
```

The `tts/` environment is required to narrate anything: without `tts/.venv`, a `voice` step with clips to make stops with an error giving the commands above. The first narration also downloads the Kokoro model weights from Hugging Face. See `tts/README.md` for voices and the output layout.

Also needs `ffmpeg` and `ffprobe` on `PATH` (narration encodes MP3 with them, every upload encodes HLS), and, for uploads (worker `render` jobs, legacy `publish`), `gcloud` signed in with access to `gs://mintsy-media`. The worker also needs `MONGODB_URI` in `.env`.

## Worker (admin dashboard jobs)

```sh
pnpm worker                              # runs queued jobs from <MONGODB_DB>.studio_jobs, one at a time
STUDIO_WORKER_DRY_RUN=1 pnpm worker      # fake results, no Claude / Kokoro / Remotion / ffmpeg / bucket
```

| Env | Default | |
|---|---|---|
| `MONGODB_URI` | (required) | e.g. `mongodb://localhost:27017` |
| `MONGODB_DB` | `mintsy_studio` | database holding `books`, `studio_jobs` and `studio_workers`, the only collections the worker touches. It needs `readWrite` here and nothing on `mintsy_app`; on startup it creates the `books` `{ order: 1 }` and `studio_jobs` `{ status: 1, createdAt: 1 }` indexes if missing |
| `STUDIO_WORKER_DRY_RUN` | off | `1` fakes every job's work and result, but still writes `studio_jobs` and `books` |
| `STUDIO_WORKER_ID` | hostname | stored on claimed jobs; on startup, `running` jobs with this id are marked `failed` |
| `STUDIO_WORKER_POLL_MS` | `2000` | how often to look for a queued job when idle |

Job flow (contract: "Studio jobs" in `.claude/skills/mintsy-contracts`): the dashboard inserts `{ kind, bookId, …, status: "queued", log: [], createdAt }`; the worker claims the oldest queued job (`findOneAndUpdate` → `running`, `startedAt`, `workerId`), streams console output into `log` (last 500 lines, flushed every second), and finishes it as `succeeded` + `result` or `failed` + `error`.

| Kind | Input | Does | `result` |
|---|---|---|---|
| `ingest` | `bookId`, `pdfPath` | `ingest`, then inserts the book into `books` (status `draft`, `episodes: []`, `order` after the last book) only if the id is new | `{ book: { title, author, category, description }, chapters: [{ number, title }] }` |
| `script` | `bookId`, `chapter`, `regenerate?` | episode steps up to `scenes` (from `script` when `regenerate`) | `{ script, scenes }` (contents of script.json / scenes.json) |
| `render` | `bookId`, `chapter`, `scriptJson?`, `scenesJson?` | writes the edited files, reruns from `voice` (from `scenes` if only the script's narration changed), renders, encodes HLS, uploads, upserts the episode into `books` as `draft` | `{ durationSec, videoPath, thumbnailPath, hlsPath }` |

A render job always re-renders and always returns the episode to `draft`, even if it was published. Voice audio is cached per scene and voice, so only changed narration is voiced again. Ctrl-C stops the worker after the current job; a second Ctrl-C aborts the job and marks it failed.

## Usage

```sh
pnpm run pipeline ingest ~/Books/psychology-of-money.pdf --book psychology-of-money
pnpm run pipeline episode --book psychology-of-money --chapter 4
```

Legacy: `pnpm run pipeline publish --book <id> --chapter <n>` uploads and writes `mintsy-web/apps/backend/scripts/catalog.json` for `pnpm seed:catalog`. Seeding only adds missing books now, so use the worker (`render` job) to get episodes into MongoDB.

Every step writes a file you can read and edit. A step is skipped when its output already exists, so hand edits survive; use `--from <step>` to regenerate from that step on (e.g. `--from scenes` after editing `script.json`, `--from render` after changing a template), and `--to <step>` to stop early (e.g. `--to scenes` to review before voicing).

The `--book` id becomes the book's id in the app; use the existing id (e.g. `psychology-of-money`) to fill in that series' episodes.

Episodes voiced before Kokoro have flat `audio/NN.mp3` clips and a `voice.json`, with no `voices/`. `--from render` keeps using that audio. Rerunning the `voice` step (`--from voice` or earlier, or any worker `render` job, which always reruns it) narrates the whole episode again with Kokoro, replaces `voice.json` and leaves the flat clips unused.

## Look

Episodes use the **collage** style by default: diagonal stripes, paper cut-out cards, puppet figures, icon stickers, rubber stamps and condensed kinetic type, with paper grain and a vignette. Every episode opens with the mintsy logo intro (book and chapter on tape) and has a background music bed.

- `src/collage/schema.ts`: what Claude fills in per scene: one or two **beats**, each a background plus a layout (`stage`, `headline`, `counter`, `lineup`, `versus`, `takeaways`) made of props (puppet `figure`s with hat/mood/outfit, or `icon`s) that appear on spoken cue phrases.
- `src/collage/Layouts.tsx`: how each layout is drawn; `src/collage/kit.tsx`: stripes, puppets, stamps, kinetic lines, paper finish.
- `src/collage/icons.ts`: the ~120 icons Claude may use ([Phosphor](https://phosphoricons.com), MIT). To add one, add the name to `iconNames.ts` and map it in `icons.ts`.
- `src/branding/`: the logo intro and music (`brand/intro-sting.mp3`, `brand/music-bed.mp3`, generated once with Google Lyria on Vertex AI; volumes in `Branded.tsx`).

The collage schema is too nested for constrained decoding, so Claude gets its JSON Schema in the prompt and the reply is validated (structure, verbatim narration, cue phrases, icon names) with one retry on problems. Re-running `--from scenes` with an unchanged script keeps the existing scene split, so cached narration is reused and only the visuals change.

`VIDEO_STYLE=cards pnpm run pipeline episode … --from scenes` regenerates the original text-card style instead; `render` picks the composition from the scenes' format.

## Previewing and changing the look

`pnpm dev` opens Remotion Studio with sample props (`CollageEpisode` shows every layout). To preview a generated episode with its audio:

```sh
npx remotion studio --public-dir work/<book>/ep-<nn> --props work/<book>/ep-<nn>/props.json
```

Then open the `CollageEpisode` composition. (`props.json` is written by `render`: book title, chapter, episode title and the timed scenes from `voice.json`.)

Adding a collage layout means adding it to `src/collage/schema.ts` (what Claude can ask for) and `src/collage/Layouts.tsx` (how it's drawn). The older text-card templates live in `src/episode/`.

## Content rules

The script prompt (`pipeline/steps/script.ts`) requires narration in our own words, only facts from the chapter, and at most one short attributed quote. Review scripts before publishing: summaries of copyrighted books are only safe as genuinely original commentary.

## Costs (per episode, approximate)

- Claude Opus 5.5: ingest ≈ $0.50–1.00 once per book (whole book in context); script + scenes ≈ $0.15
- Narration is local and has no per-use cost (Kokoro-82M, Apache 2.0)
- Rendering is local (a few minutes on an M-series Mac)

Remotion is free for companies of up to 3 people; larger teams need a [company license](https://www.remotion.pro/license).
