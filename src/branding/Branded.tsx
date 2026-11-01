import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";

import { INTRO_FRAMES } from "../episode/timing";
import { pauseLevel } from "../collage/polish";
import { Intro, type IntroProps } from "./Intro";

/** Brand audio lives in studio/brand/ and is copied into each render's public dir under brand/. */
export const BRAND_FILES = ["brand/intro-sting.mp3", "brand/music-bed.mp3"];

const STING_VOLUME = 0.85;
/** Bed under the narrator: quiet enough that George stays clearly on top. */
const BED_VOLUME = 0.13;
/** With ducking (polish): lower under speech, lifting in the pauses between lines and scenes. */
const BED_SPEECH = 0.09;
const BED_PAUSE = 0.22;
const DUCK_RAMP_SEC = 0.35;

/** Wraps an episode body with the logo intro, the intro sting and a background music bed. */
export const Branded: React.FC<
  IntroProps & {
    music?: boolean;
    /** Frame ranges (relative to the episode body) with narration; when given, the bed ducks under them. */
    speech?: [number, number][];
    children: React.ReactNode;
  }
> = ({ music = true, speech, children, ...intro }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const bodyFrames = durationInFrames - INTRO_FRAMES;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={INTRO_FRAMES} name="Intro">
        <Intro {...intro} />
      </Sequence>
      <Sequence from={INTRO_FRAMES} name="Episode" premountFor={fps}>
        {children}
      </Sequence>
      {music ? (
        <>
          <Audio src={staticFile(BRAND_FILES[0])} volume={STING_VOLUME} />
          {/* Bed fades in under the end of the sting and out over the last two seconds */}
          <Sequence from={INTRO_FRAMES - fps} premountFor={fps}>
            <Audio
              src={staticFile(BRAND_FILES[1])}
              loop
              volume={(f) => {
                const envelope = interpolate(
                  f,
                  [0, fps * 1.5, bodyFrames - fps, bodyFrames + fps],
                  [0, 1, 1, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
                if (!speech) return envelope * BED_VOLUME;
                // The bed starts one second before the body
                const lift = pauseLevel(f - fps, speech, DUCK_RAMP_SEC * fps);
                return envelope * (BED_SPEECH + (BED_PAUSE - BED_SPEECH) * lift);
              }}
            />
          </Sequence>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
