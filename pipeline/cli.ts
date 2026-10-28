import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { episodeDir, files } from "./paths";
import { ingest, writeChapter } from "./steps/ingest";
import { publish } from "./steps/publish";
import { render } from "./steps/render";
import { writeScenes } from "./steps/scenes";
import { writeScript } from "./steps/script";
import { listVoices, writeVoice } from "./steps/voice";

const USAGE = `Usage: pnpm run pipeline <command> [options]

  ingest <book.pdf> --book <id>         Extract text, find the book's metadata and chapters
  episode --book <id> --chapter <n>     Chapter → script → scenes → voice → render
          [--from <step>] [--to <step>]   Re-run from a step (later steps rerun too) / stop after one
  publish --book <id> --chapter <n>     Upload the video and add the episode to the backend catalog
  voices                                List ElevenLabs voices

Steps: ${["chapter", "script", "scenes", "voice", "render"].join(", ")}
Output goes to work/<book>/ep-<nn>/.`;

const STEPS = [
  { name: "chapter", output: files.chapter },
  { name: "script", output: files.script },
  { name: "scenes", output: files.scenes },
  { name: "voice", output: files.voice },
  { name: "render", output: files.video },
] as const;
type StepName = (typeof STEPS)[number]["name"];

function stepIndex(name: string | undefined, fallback: number) {
  if (name === undefined) return fallback;
  const index = STEPS.findIndex((s) => s.name === name);
  if (index < 0) throw new Error(`Unknown step "${name}". Steps: ${STEPS.map((s) => s.name).join(", ")}`);
  return index;
}

async function runEpisode(bookId: string, chapter: number, from?: string, to?: string) {
  const dir = episodeDir(bookId, chapter);
  const fromIndex = stepIndex(from, Infinity);
  const toIndex = stepIndex(to, STEPS.length - 1);

  const actions: Record<StepName, () => Promise<void>> = {
    chapter: () => writeChapter(bookId, chapter, dir),
    script: () => writeScript(bookId, chapter, dir),
    scenes: () => writeScenes(dir),
    voice: () => writeVoice(dir),
    render: () => render(bookId, dir),
  };

  for (const [i, step] of STEPS.entries()) {
    if (i > toIndex) break;
    // Without --from, steps whose output already exists are skipped so edits to them are kept
    if (i < fromIndex && existsSync(path.join(dir, step.output))) {
      console.log(`${step.name}: ${step.output} exists, skipping`);
      continue;
    }
    console.log(`${step.name}:`);
    await actions[step.name]();
  }
  console.log(`Done: ${path.relative(process.cwd(), dir)}`);
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      book: { type: "string" },
      chapter: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
    },
  });
  const [command, arg] = positionals;
  const book = values.book;
  const chapter = values.chapter ? Number(values.chapter) : undefined;

  if (command === "ingest" && arg && book) {
    const info = await ingest(arg, book);
    console.log(`${info.title} by ${info.author}: ${info.chapters.length} chapters`);
    for (const c of info.chapters) console.log(`  ${c.number}. ${c.title} (pages ${c.startPage}–${c.endPage})`);
  } else if (command === "episode" && book && chapter) {
    await runEpisode(book, chapter, values.from, values.to);
  } else if (command === "publish" && book && chapter) {
    await publish(book, chapter, episodeDir(book, chapter));
  } else if (command === "voices") {
    await listVoices();
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
