import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { display } from "../episode/theme";
import { condensed, palette, Stripes } from "../collage/kit";

export type IntroProps = {
  bookTitle: string;
  chapter: number;
  episodeTitle: string;
};

const BRAND = { background: "#0D0E12", foreground: "#F2F2F5", gold: "#F5B83D" };
const FONT_SIZE = 150;

/** mintsy logo reveal, then the book and chapter on paper tape. Lasts INTRO_SEC. */
export const Intro: React.FC<IntroProps> = ({
  bookTitle,
  chapter,
  episodeTitle,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sec = (s: number) => Math.round(s * fps);
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

  // Stripes wipe in diagonally behind everything
  const wipe = interpolate(frame, [0, sec(0.45)], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const mPop = spring({
    frame: frame - sec(0.25),
    fps,
    config: { damping: 11, stiffness: 160 },
  });
  // The dot drops from above and bounces into place
  const dotDrop = spring({
    frame: frame - sec(0.7),
    fps,
    config: { damping: 7, stiffness: 140, mass: 0.8 },
  });
  const squash = interpolate(
    frame,
    [sec(0.86), sec(0.92), sec(1.05)],
    [1, 1.35, 1],
    clamp,
  );
  // "m." unfolds into "mintsy."
  const unfold = interpolate(frame, [sec(1.3), sec(1.9)], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  // Logo lifts to make room for the book card
  const lift = interpolate(frame, [sec(2.0), sec(2.5)], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const tape1 = spring({
    frame: frame - sec(2.3),
    fps,
    config: { damping: 12 },
  });
  const tape2 = spring({
    frame: frame - sec(2.6),
    fps,
    config: { damping: 12 },
  });
  const exit = interpolate(
    frame,
    [durationInFrames - sec(0.35), durationInFrames],
    [1, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.background, opacity: exit }}>
      <AbsoluteFill
        style={{
          clipPath: `polygon(0 0, ${wipe * 140}% 0, ${wipe * 140 - 40}% 100%, 0 100%)`,
        }}
      >
        <Stripes a={BRAND.background} b={palette.plum} width={40} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          translate: `0 ${-lift * 90}px`,
          scale: String(1 - lift * 0.25),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: display,
            fontWeight: 700,
            fontSize: FONT_SIZE,
            letterSpacing: -4,
            color: BRAND.foreground,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              display: "inline-block",
              scale: String(mPop),
              transformOrigin: "50% 80%",
            }}
          >
            m
          </span>
          <span
            style={{
              display: "inline-block",
              overflow: "hidden",
              maxWidth: unfold * 4.2 * FONT_SIZE * 0.6,
              whiteSpace: "nowrap",
              opacity: unfold,
            }}
          >
            intsy
          </span>
          <span
            style={{
              display: "inline-block",
              width: FONT_SIZE * 0.24,
              height: FONT_SIZE * 0.24,
              marginLeft: FONT_SIZE * 0.06,
              borderRadius: "50%",
              backgroundColor: BRAND.gold,
              translate: `0 ${(1 - dotDrop) * -FONT_SIZE * 2.2}px`,
              scale: `${squash} ${1 / squash}`,
              transformOrigin: "50% 100%",
              opacity: frame >= sec(0.7) ? 1 : 0,
            }}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 230,
          gap: 14,
        }}
      >
        <div
          style={{
            scale: String(tape1),
            rotate: "-2deg",
            backgroundColor: palette.pink,
            padding: "6px 24px",
            boxShadow: `6px 6px 0 ${palette.ink}`,
          }}
        >
          <span
            style={{
              fontFamily: condensed,
              fontWeight: 700,
              fontSize: 44,
              color: palette.white,
              textTransform: "uppercase",
            }}
          >
            {bookTitle}
          </span>
        </div>
        <div
          style={{
            scale: String(tape2),
            rotate: "1.5deg",
            backgroundColor: palette.cream,
            padding: "4px 20px",
            boxShadow: `6px 6px 0 ${palette.ink}`,
          }}
        >
          <span
            style={{
              fontFamily: condensed,
              fontWeight: 500,
              fontSize: 32,
              color: palette.ink,
              textTransform: "uppercase",
            }}
          >
            Chapter {chapter} · {episodeTitle}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
