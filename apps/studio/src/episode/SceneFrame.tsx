import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { colors, SAFE_X, SAFE_Y } from "./theme";

/** Backdrop tinted with the book's color, with a short fade at both ends of the scene. */
export const SceneFrame: React.FC<{
  tint: string;
  children: React.ReactNode;
}> = ({ tint, children }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        backgroundImage: `radial-gradient(ellipse 90% 80% at 15% 10%, ${tint} 0%, ${colors.background} 70%)`,
      }}
    >
      <AbsoluteFill
        style={{
          padding: `${SAFE_Y}px ${SAFE_X}px`,
          justifyContent: "center",
          opacity: interpolate(
            frame,
            [0, 0.3 * fps, durationInFrames - 0.3 * fps, durationInFrames],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
