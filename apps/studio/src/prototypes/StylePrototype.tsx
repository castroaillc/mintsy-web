import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Series,
  staticFile,
  useVideoConfig,
} from "remotion";

import { Branded } from "../branding/Branded";
import type { IntroProps } from "../branding/Intro";
import { INTRO_FRAMES, sceneFrames } from "../episode/timing";
import { PaperFinish } from "../collage/kit";
import { AdviceScene, ManScene, MiracleScene } from "./collage/scenes";
import {
  IllAdviceScene,
  IllManScene,
  IllMiracleScene,
} from "./illustrated/scenes";

/** Narration clips for the three prototype scenes (scenes 1, 3 and 5 of the Bennett chapter 1 episode). */
export type PrototypeProps = IntroProps & {
  clips: { audio: string; audioSec: number }[];
};

export const calculatePrototypeMetadata: CalculateMetadataFunction<
  PrototypeProps
> = ({ props }) => ({
  durationInFrames: Math.max(
    1,
    INTRO_FRAMES +
      props.clips.reduce((sum, c) => sum + sceneFrames(c.audioSec), 0),
  ),
});

const Prototype: React.FC<PrototypeProps & { scenes: React.FC[] }> = ({
  clips,
  scenes,
  ...intro
}) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Branded {...intro}>
        <Series>
          {scenes.map((Scene, i) => (
            <Series.Sequence
              key={i}
              durationInFrames={sceneFrames(clips[i]?.audioSec ?? 5)}
              premountFor={fps}
            >
              <Scene />
              {clips[i]?.audio ? (
                <Audio src={staticFile(clips[i].audio)} />
              ) : null}
            </Series.Sequence>
          ))}
        </Series>
      </Branded>
      <PaperFinish />
    </AbsoluteFill>
  );
};

export const CollagePrototype: React.FC<PrototypeProps> = (props) => (
  <Prototype {...props} scenes={[ManScene, AdviceScene, MiracleScene]} />
);

export const IllustratedPrototype: React.FC<PrototypeProps> = (props) => (
  <Prototype
    {...props}
    scenes={[IllManScene, IllAdviceScene, IllMiracleScene]}
  />
);
