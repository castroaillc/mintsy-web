import { parseArgs } from "node:util";

import { runEpisode, STEPS } from "./episode";
import { episodeDir } from "./paths";
import { ingest } from "./steps/ingest";
import { publish } from "./steps/publish";

const USAGE = `Usage: pnpm run pipeline <command> [options]

  ingest <book.pdf> --book <id>         Extract text, find the book's metadata and chapters
  episode --book <id> --chapter <n>     Chapter → script → scenes → voice → render
          [--from <step>] [--to <step>]   Re-run from a step (later steps rerun too) / stop after one
  publish --book <id> --chapter <n>     (legacy) Upload the video and add the episode to apps/backend/scripts/catalog.json

Steps: ${STEPS.map((s) => s.name).join(", ")}
Output goes to work/<book>/ep-<nn>/. Staff normally use the admin dashboard + \`pnpm worker\` instead.`;

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
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
