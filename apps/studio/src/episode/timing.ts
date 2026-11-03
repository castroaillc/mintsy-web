/** Shared by the composition and the pipeline so transcript times match the rendered video. */
export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 720;

/** Logo intro before the first scene; narration and transcript times start after it. */
export const INTRO_SEC = 4.5;
export const INTRO_FRAMES = Math.round(INTRO_SEC * FPS);

/** Silence after each scene's narration before the next scene starts. */
export const SCENE_PAD_SEC = 0.5;

export function sceneFrames(audioSec: number) {
  return Math.ceil((audioSec + SCENE_PAD_SEC) * FPS);
}
