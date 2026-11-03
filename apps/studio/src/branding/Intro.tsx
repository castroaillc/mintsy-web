import { getTheme } from "@mintsy/brand";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { condensed, palette, Stripes } from "../collage/kit";
import {
  DOT_BOTTOM,
  DOT_CENTER,
  DOT_LEFT,
  LOGO_BASELINE,
  LOGO_INTSY,
  LOGO_M,
  LOGO_M_END,
  MARK_DOT_LEFT,
  WORDMARK,
} from "./logo";

export type IntroProps = {
  bookTitle: string;
  chapter: number;
  episodeTitle: string;
};

const BRAND = { background: getTheme("ink-coral", "dark").background };
/** Pixels per wordmark unit: the wordmark's font units are 1000/em, so this draws it at 150px type. */
const LOGO_SCALE = 0.15;
/** How far below the frame's center the logo's box sits, so its baseline stays where it has always been. */
const LOGO_NUDGE_Y = 13;
const REVEAL_CLIP_ID = "intro-logo-reveal";

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
  // Everything stays centered as it unfolds, from the official "m." mark to the full wordmark
  const dotShift = (1 - unfold) * (MARK_DOT_LEFT - DOT_LEFT);
  const centerShift = -dotShift / 2;
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
        <svg
          viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
          width={WORDMARK.width * LOGO_SCALE}
          height={WORDMARK.height * LOGO_SCALE}
          style={{ overflow: "visible", translate: `0 ${LOGO_NUDGE_Y}px` }}
        >
          <defs>
            <clipPath id={REVEAL_CLIP_ID}>
              <rect
                x={LOGO_M_END}
                y={0}
                width={DOT_LEFT + dotShift - LOGO_M_END}
                height={WORDMARK.height}
              />
            </clipPath>
          </defs>
          <g
            fill={WORDMARK.onDark.letters}
            transform={`translate(${centerShift} 0)`}
          >
            <path
              d={LOGO_M}
              transform={`translate(${LOGO_M_END / 2} ${LOGO_BASELINE}) scale(${mPop}) translate(${-LOGO_M_END / 2} ${-LOGO_BASELINE})`}
            />
            <path
              d={LOGO_INTSY}
              clipPath={`url(#${REVEAL_CLIP_ID})`}
              opacity={unfold}
            />
            {/* Dropped from above, squashed against its bottom edge, then carried out by the unfold */}
            <path
              d={WORDMARK.dot}
              fill={WORDMARK.onDark.dot}
              opacity={frame >= sec(0.7) ? 1 : 0}
              transform={`translate(${dotShift} ${(1 - dotDrop) * -2200}) translate(${DOT_CENTER} ${DOT_BOTTOM}) scale(${squash} ${1 / squash}) translate(${-DOT_CENTER} ${-DOT_BOTTOM})`}
            />
          </g>
        </svg>
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
