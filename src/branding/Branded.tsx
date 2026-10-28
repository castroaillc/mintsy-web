import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";

import { INTRO_FRAMES } from "../episode/timing";
import { Intro, type IntroProps } from "./Intro";

/** Brand audio lives in studio/brand/ and is copied into each render's public dir under brand/. */
export const BRAND_FILES = ["brand/intro-sting.mp3", "brand/music-bed.mp3"];

const STING_VOLUME = 0.85;
/** Bed under the narrator: quiet enough that George stays clearly on top. */
const BED_VOLUME = 0.13;

/** Wraps an episode body with the logo intro, the intro sting and a background music bed. */
export const Branded: React.FC<
  IntroProps & { music?: boolean; children: React.ReactNode }
> = ({ music = true, children, ...intro }) => {
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
              volume={(f) =>
                interpolate(
                  f,
                  [0, fps * 1.5, bodyFrames - fps, bodyFrames + fps],
                  [0, BED_VOLUME, BED_VOLUME, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                )
              }
            />
          </Sequence>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
