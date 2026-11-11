# studio

Turns a book PDF into mintsy episodes: one ~5-minute narrated, animated video per chapter. Staff run it from the admin dashboard, which queues jobs that `pnpm worker` runs here.

## Setup

Colors and the logo come from `@mintsy/brand`, and categories and catalog types from `@mintsy/shared`. Both are linked from `../../packages/`.

This folder is its own pnpm workspace with its own lockfile, so Remotion stays out of the backend image. Install and run it from here, or use `pnpm dev:worker` at the repo root for the worker.

```sh
pnpm install
cp .env.example .env     # everything in it is optional except MONGODB_URI for the worker
claude auth login        # Claude Code CLI on your Claude subscription; `claude` must be on the worker's PATH
brew install uv espeak-ng ffmpeg
(cd tts && uv sync)      # required: the Kokoro narration environment, about 1 GB with PyTorch
```

See [`tts/README.md`](tts/README.md) for voices. Uploads run the `gcloud` CLI, so it must be installed, but they don't need `gcloud auth login`: they authenticate with the service account key at `STUDIO_GCP_KEY_FILE` (default `~/.config/mintsy/studio-uploader.json`). Without that file, they fall back to your own `gcloud` login, which needs access to `gs://mintsy-media`.

## Run

```sh
pnpm worker                              # runs queued jobs from the admin dashboard, one at a time
STUDIO_WORKER_DRY_RUN=1 pnpm worker      # fake results, no Claude / Kokoro / Remotion / ffmpeg / bucket
pnpm run pipeline ingest ~/Books/psychology-of-money.pdf --book psychology-of-money
pnpm run pipeline episode --book psychology-of-money --chapter 4
pnpm dev                                 # Remotion Studio
```

## Documentation

The pipeline steps, job kinds, video system, costs and env vars are in the mintsy docs:
[`apps/docs/services/studio.md`](../docs/services/studio.md).
