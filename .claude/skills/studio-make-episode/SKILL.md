---
name: studio-make-episode
description: Producing and revising a mintsy episode with the studio pipeline, with review gates before the paid and public steps.
---
# Making an episode

Run from `apps/studio/`. Staff usually do this from the admin dashboard, with `pnpm worker` running the queue. The CLI does the same steps by hand. `pnpm run` is required, because pnpm has its own `pipeline` command.

```sh
pnpm run pipeline ingest <path/to/book.pdf> --book <book-id>          # once per book; costs Claude credits
pnpm run pipeline episode --book <book-id> --chapter <n> --to scenes   # script and scenes only
# review gate 1
pnpm run pipeline episode --book <book-id> --chapter <n>               # voice (Kokoro, local) and render
# review gate 2
```

Use an existing book id to add episodes to an existing series. If the PDF path isn't given, ask for it.

## Review gate 1: `work/<book>/ep-<nn>/script.json` and `scenes.json`
- About 700 words, in our own words, only facts from the chapter, at most one short attributed quote.
- A one-line summary and 3 takeaways that a reader of the chapter would agree with.
- 10–16 scenes. Icon names exist in `src/collage/iconNames.ts`, and cue phrases appear verbatim in the narration.
- Fix by editing the JSON by hand, because edits survive, or rerun with `--from script` or `--from scenes`.

## Review gate 2: the render
- `episode.mp4` is about 5 minutes and `thumbnail.jpg` looks right. View it.
- Spot-check a few frames with `ffmpeg -ss <t> -i episode.mp4 -frames:v 1 <file>.jpg`, and view them for overflowing text or missing props.
- For visual fixes, change the templates, then rerun with `--from render`.

## Getting it to the app
1. Uploading goes to the production bucket and writes a draft to MongoDB, so **it needs approval**. The worker's `render` and `upload` jobs do this.
2. Staff review the draft and publish it in the admin dashboard. A draft isn't visible in the app until then.

`pnpm run pipeline publish` and `pnpm seed:catalog` are legacy. Don't use them for new episodes.
