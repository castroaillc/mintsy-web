/**
 * Vertical social clips: a few whole scenes of one voice, with burned-in captions and an end card,
 * in work/<book>/ep-NN/clips/. Local only: posting is manual.
 */
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import { CLIP_HEIGHT, CLIP_MAX_SCENES, CLIP_MAX_SEC, CLIP_MIN_SEC, CLIP_WIDTH, END_CARD_SEC } from "../../src/collage/clipLayout";
import type { CollageClipProps, TimedCollageScene } from "../../src/collage/schema";
import { FPS, sceneFrames } from "../../src/episode/timing";
import { bookDir, files, STUDIO_DIR } from "../paths";
import { copyBrandAssets, mediaDurationSec, readJson, run } from "../util";
import { renderTargets } from "../voices";
import type { BookInfo } from "./ingest";
import { checkAudio, stagePublicDir } from "./render";
import type { Voice } from "./voice";

/** Paths are relative to the episode folder. */
export interface ClipResult {
  videoPath: string;
  thumbnailPath: string;
  /** Voice id, or "voice" for an episode voiced before Kokoro. */
  voice: string;
  startScene: number;
  endScene: number;
  /** ffprobe's duration of the finished clip, end card included. */
  durationSec: number;
  width: number;
  height: number;
}

export const clipName = (voice: string, startScene: number, endScene: number) =>
  `${voice}-s${String(startScene).padStart(2, "0")}-s${String(endScene).padStart(2, "0")}`;

const scenesSec = (scenes: { audioSec: number }[]) => scenes.reduce((sum, s) => sum + sceneFrames(s.audioSec), 0) / FPS;
const oneDecimal = (sec: number) => sec.toFixed(1);

/**
 * The scenes of a clip, 1-based and inclusive. Without an end, takes the fewest scenes that reach
 * the minimum. The scenes must reach the minimum on their own, and the finished clip with its end
 * card must stay within the maximum.
 */
export function selectClipScenes<S extends { audioSec: number }>(scenes: S[], startScene = 1, endScene?: number) {
  if (!Number.isInteger(startScene) || startScene < 1 || startScene > scenes.length) {
    throw new Error(`Clip start scene ${startScene} isn't between 1 and ${scenes.length}`);
  }
  let end = endScene;
  if (end === undefined) {
    end = startScene;
    while (end < scenes.length && end - startScene + 1 < CLIP_MAX_SCENES && scenesSec(scenes.slice(startScene - 1, end)) < CLIP_MIN_SEC) end++;
  }
  if (!Number.isInteger(end) || end < startScene || end > scenes.length) {
    throw new Error(`Clip end scene ${end} isn't between ${startScene} and ${scenes.length}`);
  }
  const count = end - startScene + 1;
  if (count > CLIP_MAX_SCENES) throw new Error(`A clip has at most ${CLIP_MAX_SCENES} scenes; scenes ${startScene} to ${end} are ${count}`);
  const selected = scenes.slice(startScene - 1, end);
  const sec = scenesSec(selected);
  const label = `Scenes ${startScene} to ${end} run ${oneDecimal(sec)} s`;
  if (sec < CLIP_MIN_SEC) throw new Error(`${label}, under the ${CLIP_MIN_SEC} s minimum for a clip. Choose a longer range`);
  if (sec + END_CARD_SEC > CLIP_MAX_SEC) {
    throw new Error(`${label}, which with the ${END_CARD_SEC} s end card is over the ${CLIP_MAX_SEC} s maximum for a clip. Choose a shorter range`);
  }
  return { startScene, endScene: end, scenes: selected, sec };
}

/** Throws if scenes.json has moved on since this voice was made: its audio and word timings would no longer match. */
function checkTrackCurrent(track: Voice, current: { narration: string; beats?: unknown }[], trackId: string) {
  const same =
    track.scenes.length === current.length &&
    track.scenes.every((scene, i) => {
      const beats = (scene as { beats?: unknown }).beats;
      return scene.narration === current[i].narration && JSON.stringify(beats) === JSON.stringify(current[i].beats);
    });
  if (!same) throw new Error(`scenes.json has changed since track "${trackId}" was voiced: rerun with --from voice`);
}

export type ClipOptions = { voice?: string; startScene?: number; endScene?: number };

export async function renderClip(bookId: string, epDir: string, options: ClipOptions): Promise<ClipResult> {
  const targets = await renderTargets(epDir);
  const target = options.voice ? targets.find((t) => t.voice?.id === options.voice) : targets[0];
  if (!target) {
    throw new Error(`Episode has no voice "${options.voice}". It has: ${targets.map((t) => t.voice?.id ?? "the single track, so leave voice out").join(", ")}`);
  }
  const { track, trackId } = target;
  if (!track.scenes.every((s) => "beats" in s)) throw new Error("Clips need the collage format; this episode uses the older text cards");
  checkTrackCurrent(track, await readJson(path.join(epDir, files.scenes)), trackId);
  const selection = selectClipScenes(track.scenes as unknown as TimedCollageScene[], options.startScene, options.endScene);
  checkAudio(epDir, { ...target, track: { ...track, scenes: selection.scenes } as unknown as Voice });

  const book = await readJson<BookInfo>(path.join(bookDir(bookId), files.book));
  const voice = target.voice?.id ?? "voice";
  const name = clipName(voice, selection.startScene, selection.endScene);
  const clipsDir = path.join(epDir, "clips");
  await mkdir(clipsDir, { recursive: true });
  const video = path.join(clipsDir, `${name}.mp4`);
  const thumbnail = path.join(clipsDir, `${name}.jpg`);
  const inputProps: CollageClipProps = { bookTitle: book.title, scenes: selection.scenes, polish: true, captions: true, safeAreaGuide: false };

  await copyBrandAssets(STUDIO_DIR, epDir);
  const publicDir = await stagePublicDir(epDir);
  let serveUrl: string | undefined;
  try {
    console.log(`  clip: scenes ${selection.startScene} to ${selection.endScene} of ${trackId}, ${oneDecimal(selection.sec)} s plus the end card`);
    serveUrl = await bundle({ entryPoint: path.join(STUDIO_DIR, "src/index.ts"), publicDir });
    const composition = await selectComposition({ serveUrl, id: "CollageClip", inputProps });
    const raw = path.join(clipsDir, `${name}.render.mp4`);
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
        if (pct !== lastPct) console.log(`  rendering clip ${(lastPct = pct)}%`);
      },
    });
    await run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-c", "copy", "-movflags", "+faststart", video]);
    await rm(raw);
    // A poster for previews: once the first beat has animated in
    await renderStill({ serveUrl, composition, inputProps, frame: Math.min(45, composition.durationInFrames - 1), output: thumbnail, imageFormat: "jpeg", jpegQuality: 88, scale: 0.5 });
  } finally {
    await rm(publicDir, { recursive: true, force: true });
    if (serveUrl) await rm(serveUrl, { recursive: true, force: true });
  }
  const durationSec = Math.round((await mediaDurationSec(video)) * 1000) / 1000;
  console.log(`  wrote clips/${name}.mp4 (${durationSec} s)`);
  return {
    videoPath: `clips/${name}.mp4`,
    thumbnailPath: `clips/${name}.jpg`,
    voice,
    startScene: selection.startScene,
    endScene: selection.endScene,
    durationSec,
    width: CLIP_WIDTH,
    height: CLIP_HEIGHT,
  };
}
