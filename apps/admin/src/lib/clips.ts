/**
 * Clip lengths, so the form can show what a scene range runs to before queueing it. Mirrors studio's
 * selectClipScenes (apps/studio/pipeline/steps/clip.ts), which has the final say and refuses what it won't render.
 */
const FPS = 30;
const SCENE_PAD_SEC = 0.5;
export const END_CARD_SEC = 3.5;
export const CLIP_MIN_SEC = 15;
export const CLIP_MAX_SEC = 60;
export const CLIP_MAX_SCENES = 3;

const sceneFrames = (audioSec: number) => Math.ceil((audioSec + SCENE_PAD_SEC) * FPS);

export const sceneSec = (audioSec: number) => sceneFrames(audioSec) / FPS;

/** Seconds of these scenes, summed in frames like the composition. */
const scenesSec = (audioSecs: number[]) => audioSecs.reduce((sum, a) => sum + sceneFrames(a), 0) / FPS;

/** The fewest scenes from `start` that reach the minimum, up to the most a clip can have. */
export function autoEndScene(audioSecs: number[], start: number) {
  let end = start;
  while (end < audioSecs.length && end - start + 1 < CLIP_MAX_SCENES && scenesSec(audioSecs.slice(start - 1, end)) < CLIP_MIN_SEC) end++;
  return end;
}

export type ClipPlan = { start: number; end: number; scenesSec: number; finishedSec: number; problem: string | null };

/** The clip these scenes make, 1-based and inclusive. Without `end`, what studio picks by default. */
export function planClip(audioSecs: number[], start: number, end?: number): ClipPlan {
  const last = end ?? autoEndScene(audioSecs, start);
  const sec = scenesSec(audioSecs.slice(start - 1, last));
  const finishedSec = sec + END_CARD_SEC;
  const label = `Scenes ${start} to ${last} run ${sec.toFixed(1)} s`;
  let problem: string | null = null;
  if (last - start + 1 > CLIP_MAX_SCENES) problem = `A clip has at most ${CLIP_MAX_SCENES} scenes.`;
  else if (sec < CLIP_MIN_SEC) problem = `${label}, under the ${CLIP_MIN_SEC} s minimum. Choose a longer range.`;
  else if (finishedSec > CLIP_MAX_SEC) problem = `${label}, which with the ${END_CARD_SEC} s end card is over the ${CLIP_MAX_SEC} s maximum. Choose a shorter range.`;
  return { start, end: last, scenesSec: sec, finishedSec, problem };
}
