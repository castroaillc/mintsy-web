import { existsSync } from "node:fs";
import path from "node:path";

import { episodeDir, files } from "./paths";
import { writeChapter } from "./steps/ingest";
import { render } from "./steps/render";
import { writeScenes } from "./steps/scenes";
import { writeScript } from "./steps/script";
import { writeVoice } from "./steps/voice";

export const STEPS = [
  { name: "chapter", output: files.chapter },
  { name: "script", output: files.script },
  { name: "scenes", output: files.scenes },
  { name: "voice", output: files.voice },
  { name: "render", output: files.video },
] as const;
export type StepName = (typeof STEPS)[number]["name"];

function stepIndex(name: string | undefined, fallback: number) {
  if (name === undefined) return fallback;
  const index = STEPS.findIndex((s) => s.name === name);
  if (index < 0) throw new Error(`Unknown step "${name}". Steps: ${STEPS.map((s) => s.name).join(", ")}`);
  return index;
}

/**
 * Runs an episode's steps in order. Steps before `from` are skipped when their output already
 * exists (so hand edits survive); `from` and everything after it always rerun; `to` stops early.
 */
export async function runEpisode(bookId: string, chapter: number, from?: string, to?: string) {
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
    if (i < fromIndex && existsSync(path.join(dir, step.output))) {
      console.log(`${step.name}: ${step.output} exists, skipping`);
      continue;
    }
    console.log(`${step.name}:`);
    await actions[step.name]();
  }
  console.log(`Done: ${path.relative(process.cwd(), dir)}`);
  return dir;
}
