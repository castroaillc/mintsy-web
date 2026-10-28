import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { generate } from "../claude";
import { bookDir, files } from "../paths";
import { readJson, writeJson } from "../util";
import type { BookInfo } from "./ingest";

export const Script = z.object({
  title: z.string().describe("Episode title; usually the chapter title"),
  summary: z.string().describe("One sentence, at most 20 words, for the episode list in the app"),
  takeaways: z.array(z.string()).describe("Exactly 3 takeaways, each at most 15 words"),
  narration: z.array(z.string()).describe("The voiceover, as paragraphs"),
});
export type Script = z.infer<typeof Script>;

const SYSTEM = `You write narration scripts for mintsy, an app that turns each chapter of a nonfiction book into a 5-minute narrated video episode.

Write one episode from the chapter you are given:
- Length: 650–750 words of narration, about 5 minutes spoken.
- Shape: open with a hook (a story, question or surprising fact from the chapter), explain the chapter's core ideas with its own concrete examples, give the viewer one practical way to apply it, and close with a short recap.
- Written for the ear: short sentences, plain words, no headings, lists or stage directions. Say "you" to the viewer. Spell out anything a narrator could misread.
- Faithful: only claims, numbers and examples that are in the chapter. Name the author when you attribute an idea to them.
- Original: explain the ideas in your own words. Never reproduce the author's sentences; at most one short direct quote (under 20 words), clearly attributed.
- The takeaways are what the viewer should remember; the final recap in the narration covers the same three points.`;

export async function writeScript(bookId: string, chapter: number, epDir: string) {
  const book = await readJson<BookInfo>(path.join(bookDir(bookId), files.book));
  const chapterText = await readFile(path.join(epDir, files.chapter), "utf8");

  const script = await generate({
    label: "script",
    schema: Script,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Book: ${book.title} by ${book.author}\nEpisode ${chapter} of ${book.chapters.length}\n\n<chapter>\n${chapterText}\n</chapter>`,
      },
    ],
  });

  const words = script.narration.join(" ").split(/\s+/).length;
  console.log(`  script "${script.title}": ${words} words (~${(words / 150).toFixed(1)} min)`);
  await writeJson(path.join(epDir, files.script), script);
}
