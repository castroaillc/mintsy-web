// Renders a style prototype with real narration: npx tsx pipeline/prototype.ts <CompositionId> <book> <chapter> <scene,scene,...>
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import { episodeDir, files, STUDIO_DIR } from "./paths";
import { copyBrandAssets, readJson } from "./util";
import type { Script } from "./steps/script";
import type { Voice } from "./steps/voice";

async function main() {
  const [id, book, chapter, scenes] = process.argv.slice(2);
  const epDir = episodeDir(book, Number(chapter));
  const voice = await readJson<Voice>(path.join(epDir, files.voice));
  const clips = scenes.split(",").map((n) => {
    const s = voice.scenes[Number(n) - 1];
    return { audio: s.audio, audioSec: s.audioSec };
  });
  const script = await readJson<Script>(path.join(epDir, files.script));
  const bookInfo = await readJson<{ title: string }>(path.join(epDir, "..", files.book));
  const inputProps = { bookTitle: bookInfo.title, chapter: Number(chapter), episodeTitle: script.title, clips };
  await copyBrandAssets(STUDIO_DIR, epDir);

  const serveUrl = await bundle({ entryPoint: path.join(STUDIO_DIR, "src/index.ts"), publicDir: epDir });
  const composition = await selectComposition({ serveUrl, id, inputProps });
  const out = path.join(epDir, `${id}.mp4`);
  await renderMedia({ serveUrl, composition, inputProps, codec: "h264", crf: 20, outputLocation: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
