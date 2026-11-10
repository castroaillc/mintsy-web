/** How long the player's controls stay up after the last interaction while a video plays. */
export const CONTROLS_AUTO_HIDE_MS = 3500;

/** The app's fade timings, as the toast uses them. */
export const CONTROLS_FADE_IN_MS = 180;
export const CONTROLS_FADE_OUT_MS = 150;

/**
 * How long playback must stay stopped before the controls come back by themselves. iOS reports "not playing" for
 * under a frame on every resume, before it has reported a stall as `loading`, and neither should flash the controls.
 */
export const PAUSE_REVEAL_DELAY_MS = 250;

/** Whether the controls may fade by themselves. A screen reader needs them to stay in place. */
export function canAutoHide({
  playing,
  scrubbing,
  menuOpen,
  screenReader,
}: {
  playing: boolean;
  scrubbing: boolean;
  menuOpen: boolean;
  screenReader: boolean;
}) {
  return playing && !scrubbing && !menuOpen && !screenReader;
}

/** Stopped for a reason the viewer should be able to act on: paused, ended or failed, but not just waiting for data. */
export function isStopped({ playing, buffering }: { playing: boolean; buffering: boolean }) {
  return !playing && !buffering;
}
