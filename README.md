# studio

Turns a book PDF into mintsy episodes: one ~5-minute narrated, animated video per chapter. Staff run it from the admin dashboard, which queues jobs that `pnpm worker` runs here.

## Setup

Colors and the logo come from `@mintsy/brand`, and categories and catalog types from `@mintsy/shared`. Both are linked from `../mintsy-web/packages/`, so `mintsy-web` must be cloned next to this folder.

```sh
pnpm install
cp .env.example .env     # everything in it is optional except MONGODB_URI for the worker
ant auth login           # or set ANTHROPIC_API_KEY in .env
brew install uv espeak-ng ffmpeg
(cd tts && uv sync)      # required: the Kokoro narration environment, about 1 GB with PyTorch
```

See [`tts/README.md`](tts/README.md) for voices. Uploads also need `gcloud` signed in with access to `gs://mintsy-media`.

## Run

```sh
pnpm worker                              # runs queued jobs from the admin dashboard, one at a time
STUDIO_WORKER_DRY_RUN=1 pnpm worker      # fake results, no Claude / Kokoro / Remotion / ffmpeg / bucket
pnpm run pipeline ingest ~/Books/psychology-of-money.pdf --book psychology-of-money
pnpm run pipeline episode --book psychology-of-money --chapter 4
pnpm dev                                 # Remotion Studio
```

## Documentation

The pipeline steps, job kinds, video system, costs and env vars are in the hub repo:
[`docs/services/studio.md`](https://github.com/castroaillc/mintsy-hub/blob/main/docs/services/studio.md).
