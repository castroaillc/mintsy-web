import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { Easing, interpolate } from "remotion";

// Same type and colors as the mintsy app (mobile-app/design/README.md)
export const display = loadSpaceGrotesk("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
}).fontFamily;
export const body = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
}).fontFamily;

export const colors = {
  background: "#0D0E12",
  card: "#1D1F27",
  border: "#2A2C36",
  foreground: "#F2F2F5",
  muted: "#A3A5B0",
  accent: "#F5B83D",
  accentInk: "#1C1C1C",
};

/** 1280×720 frame; keep text inside these margins. */
export const SAFE_X = 96;
export const SAFE_Y = 72;

const enterEasing = Easing.bezier(0.16, 1, 0.3, 1);

/** Fade and rise in over ~0.6s starting at `startFrame`. */
export function enter(frame: number, startFrame: number, fps: number) {
  const progress = interpolate(
    frame,
    [startFrame, startFrame + 0.6 * fps],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: enterEasing,
    },
  );
  return { opacity: progress, translate: `0px ${(1 - progress) * 28}px` };
}
