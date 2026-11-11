import { Audio } from "@remotion/media";
import { pageTurn } from "@remotion/sfx";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  interpolate,
  Sequence,
  Series,
  staticFile,
  useVideoConfig,
} from "remotion";

import { BED_PAUSE, BED_SPEECH, BRAND_FILES, DUCK_RAMP_SEC } from "../branding/Branded";
import { FPS, sceneFrames } from "../episode/timing";
import { CollageSceneView } from "./CollageEpisode";
import { ClipEndCard } from "./ClipEndCard";
import { CLIP_CONTENT, CLIP_SAFE, END_CARD_SEC } from "./clipLayout";
import { PaperFinish } from "./kit";
import { pauseLevel, SceneWipe, speechRanges, WIPE_FRAMES } from "./polish";
import type { CollageClipProps } from "./schema";

const END_CARD_FRAMES = Math.round(END_CARD_SEC * FPS);

export const calculateClipMetadata: CalculateMetadataFunction<CollageClipProps> = ({ props }) => ({
  durationInFrames: props.scenes.reduce((sum, s) => sum + sceneFrames(s.audioSec), 0) + END_CARD_FRAMES,
});

/** Draws the safe area and the text zone over the picture, for reviewing stills. */
const SafeAreaGuide: React.FC = () => {
  const box = (left: number, top: number, right: number, bottom: number, color: string) => (
    <div style={{ position: "absolute", left, top, width: right - left, height: bottom - top, border: `4px dashed ${color}` }} />
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {box(CLIP_SAFE.left, CLIP_SAFE.top, CLIP_SAFE.right, CLIP_SAFE.lowerFrom, "#00E5FF")}
      {box(CLIP_SAFE.left, CLIP_SAFE.lowerFrom, CLIP_SAFE.lowerRight, CLIP_SAFE.bottom, "#00E5FF")}
      {box(CLIP_CONTENT.left, CLIP_CONTENT.top, CLIP_CONTENT.right, CLIP_CONTENT.bottom, "#FF00E5")}
    </AbsoluteFill>
  );
};

/** A vertical clip for social platforms: whole scenes from one voice, burned-in captions, then the end card. */
export const CollageClip: React.FC<CollageClipProps> = ({ bookTitle, scenes, polish = true, captions = true, safeAreaGuide = false }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const sceneStarts = scenes.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + sceneFrames(scenes[i - 1].audioSec)], []);
  const speech = speechRanges(scenes, sceneStarts, fps);
  const cardStart = durationInFrames - END_CARD_FRAMES;
  return (
    <AbsoluteFill>
      <Series>
        {scenes.map((scene, i) => (
          <Series.Sequence key={i} durationInFrames={sceneFrames(scene.audioSec)} premountFor={fps}>
            <CollageSceneView scene={scene} polish={polish} captions={captions} portrait />
            {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={END_CARD_FRAMES} premountFor={fps}>
          <ClipEndCard bookTitle={bookTitle} />
        </Series.Sequence>
      </Series>
      {[...sceneStarts.slice(1), cardStart].map((start, i) => (
        <Sequence key={i} from={start - WIPE_FRAMES / 2} durationInFrames={WIPE_FRAMES} premountFor={fps}>
          <SceneWipe portrait />
          <Audio src={pageTurn} volume={0.3} />
        </Sequence>
      ))}
      {/* The bed is there from the first frame, because there's no intro to lead into it */}
      <Audio
        src={staticFile(BRAND_FILES[1])}
        loop
        volume={(f) => {
          const envelope = interpolate(f, [0, 3, durationInFrames - fps, durationInFrames], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return envelope * (BED_SPEECH + (BED_PAUSE - BED_SPEECH) * pauseLevel(f, speech, DUCK_RAMP_SEC * fps));
        }}
      />
      <PaperFinish vignette={0.35} />
      {safeAreaGuide ? <SafeAreaGuide /> : null}
    </AbsoluteFill>
  );
};

