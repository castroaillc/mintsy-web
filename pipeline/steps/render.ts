import { rm } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import type { CollageEpisodeProps, TimedCollageScene } from "../../src/collage/schema";
import type { EpisodeProps, TimedScene } from "../../src/episode/schema";
import { INTRO_FRAMES, sceneFrames } from "../../src/episode/timing";
import { bookDir, files, STUDIO_DIR } from "../paths";
import { copyBrandAssets, readJson, run, writeJson } from "../util";
import type { BookInfo } from "./ingest";
import type { Script } from "./script";
import type { Voice } from "./voice";

export async function render(bookId: string, epDir: string) {
  const book = await readJson<BookInfo>(path.join(bookDir(bookId), files.book));
  const voice = await readJson<Voice>(path.join(epDir, files.voice));
  const script = await readJson<Script>(path.join(epDir, files.script));
  const meta = {
    bookTitle: book.title,
    chapter: Number(path.basename(epDir).replace("ep-", "")),
    episodeTitle: script.title,
  };
  // scenes.json is in the collage format (beats) or the older text-card format (visual)
  const collage = voice.scenes.every((s) => "beats" in s);
  const compositionId = collage ? "CollageEpisode" : "Episode";
  // Polish (spring motion, scene wipes, word captions, SFX, music ducking) is on unless STUDIO_POLISH=0
  const polish = process.env.STUDIO_POLISH !== "0";
  const inputProps: CollageEpisodeProps | EpisodeProps = collage
    ? { ...meta, scenes: voice.scenes as TimedCollageScene[], polish }
    : { ...meta, author: book.author, tint: book.tint, scenes: voice.scenes as TimedScene[] };
  await copyBrandAssets(STUDIO_DIR, epDir);
  // For previewing in Studio: npx remotion studio --public-dir <epDir> --props <epDir>/props.json, then open the composition
  await writeJson(path.join(epDir, "props.json"), inputProps);

  // The episode folder is the public dir, so the composition loads narration via staticFile("audio/01.mp3")
  console.log("  bundling");
  const serveUrl = await bundle({ entryPoint: path.join(STUDIO_DIR, "src/index.ts"), publicDir: epDir });
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });

  const raw = path.join(epDir, "render.mp4");
  let lastPct = -1;
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    crf: 20,
    outputLocation: raw,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== lastPct) console.log(`  rendering ${(lastPct = pct)}%`);
    },
  });

  // Move the index to the front so the app can start playing before the whole file downloads
  await run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-c", "copy", "-movflags", "+faststart", path.join(epDir, files.video)]);
  await rm(raw);

  if (collage && polish) {
    // Designed thumbnail (src/collage/covers.tsx) at 4× the app's 132pt thumbnail, sharp on 3× screens
    const thumb = await selectComposition({ serveUrl, id: "CollageThumbnail", inputProps });
    await renderStill({
      serveUrl,
      composition: thumb,
      inputProps,
      output: path.join(epDir, files.thumbnail),
      imageFormat: "jpeg",
      jpegQuality: 88,
      scale: 528 / thumb.width,
    });
  } else {
    // Thumbnail: the second scene once its content has animated in, at 2× the app's 132pt thumbnail
    const thumbFrame = INTRO_FRAMES + sceneFrames(voice.scenes[0].audioSec) + 45;
    await renderStill({
      serveUrl,
      composition,
      inputProps,
      frame: Math.min(thumbFrame, composition.durationInFrames - 1),
      output: path.join(epDir, files.thumbnail),
      imageFormat: "jpeg",
      scale: 264 / composition.width,
    });
  }
  console.log(`  wrote ${files.video} and ${files.thumbnail}`);
}
