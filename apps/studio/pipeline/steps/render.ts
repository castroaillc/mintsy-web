import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import type { CollageEpisodeProps, TimedCollageScene } from "../../src/collage/schema";
import type { EpisodeProps, TimedScene } from "../../src/episode/schema";
import { INTRO_FRAMES, sceneFrames } from "../../src/episode/timing";
import { bookDir, files, STUDIO_DIR } from "../paths";
import { copyBrandAssets, readJson, run, writeJson } from "../util";
import { type RenderTarget, renderTargets, trackStamp } from "../voices";
import type { BookInfo } from "./ingest";
import type { Script } from "./script";
import type { Voice } from "./voice";

/**
 * A public dir with only what compositions load (narration and brand audio). Remotion copies the
 * whole public dir into each bundle, so it must never be a folder that renders and HLS land in.
 */
export async function stagePublicDir(epDir: string) {
  const dir = path.join(os.tmpdir(), `mintsy-render-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  for (const name of ["audio", "brand"]) await cp(path.join(epDir, name), path.join(dir, name), { recursive: true });
  return dir;
}

/** Fails before a long render rather than partway through it. */
export function checkAudio(epDir: string, target: RenderTarget) {
  for (const scene of target.track.scenes) {
    if (!existsSync(path.join(epDir, scene.audio))) {
      throw new Error(`${scene.audio} is missing for track "${target.trackId}", so the voices are incomplete: rerun with --from voice`);
    }
  }
}

/** Renders one video per voice (or the only track of an episode voiced before Kokoro), and the episode's thumbnail. */
export async function render(bookId: string, epDir: string) {
  const book = await readJson<BookInfo>(path.join(bookDir(bookId), files.book));
  const script = await readJson<Script>(path.join(epDir, files.script));
  const targets = await renderTargets(epDir);
  for (const target of targets) checkAudio(epDir, target);
  const meta = {
    bookTitle: book.title,
    chapter: Number(path.basename(epDir).replace("ep-", "")),
    episodeTitle: script.title,
  };
  // scenes.json is in the collage format (beats) or the older text-card format (visual)
  const collage = targets[0].track.scenes.every((s) => "beats" in s);
  const compositionId = collage ? "CollageEpisode" : "Episode";
  // Polish (spring motion, scene wipes, SFX, music ducking) is on unless STUDIO_POLISH=0
  const polish = process.env.STUDIO_POLISH !== "0";
  const propsFor = (voice: Voice): CollageEpisodeProps | EpisodeProps =>
    collage
      ? // Episodes have no burned-in captions: the app draws them from the voice's timed text
        { ...meta, scenes: voice.scenes as TimedCollageScene[], polish, captions: false }
      : { ...meta, author: book.author, tint: book.tint, scenes: voice.scenes as TimedScene[] };
  // In the episode folder too, for previewing in Studio: npx remotion studio --public-dir <epDir> --props <epDir>/props.json
  await copyBrandAssets(STUDIO_DIR, epDir);

  const publicDir = await stagePublicDir(epDir);
  let serveUrl: string | undefined;
  try {
    console.log("  bundling");
    serveUrl = await bundle({ entryPoint: path.join(STUDIO_DIR, "src/index.ts"), publicDir });

    for (const target of targets) {
      const { outDir, track, trackId } = target;
      const stamp = path.join(outDir, files.renderStamp);
      const inputProps = propsFor(track);
      await mkdir(outDir, { recursive: true });
      // Until this render finishes, nothing in this folder counts as a finished render of the track
      await rm(stamp, { force: true });
      // The HLS from the last upload no longer matches
      await rm(path.join(outDir, files.hls), { recursive: true, force: true });
      await writeJson(path.join(outDir, "props.json"), inputProps);

      const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
      const raw = path.join(outDir, "render.mp4");
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
          if (pct !== lastPct) console.log(`  rendering ${trackId} ${(lastPct = pct)}%`);
        },
      });

      // Move the index to the front so the app can start playing before the whole file downloads
      await run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-c", "copy", "-movflags", "+faststart", path.join(outDir, files.video)]);
      await rm(raw);
      await writeJson(stamp, { track: trackStamp(track) });
      console.log(`  wrote ${path.relative(epDir, path.join(outDir, files.video))}`);
    }

    // One thumbnail per episode, from the default voice
    const main = targets[0];
    const inputProps = propsFor(main.track);
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
      const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
      const thumbFrame = INTRO_FRAMES + sceneFrames(main.track.scenes[0].audioSec) + 45;
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
    console.log(`  wrote ${files.thumbnail}`);
  } finally {
    await rm(publicDir, { recursive: true, force: true });
    if (serveUrl) await rm(serveUrl, { recursive: true, force: true });
  }
}
