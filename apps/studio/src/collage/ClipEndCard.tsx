import { getTheme } from "@mintsy/brand";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { WORDMARK } from "../branding/logo";
import { CLIP_CONTENT, CLIP_SAFE, fitSize } from "./clipLayout";
import { condensed, palette, Stripes } from "./kit";

const BACKGROUND = getTheme("ink-coral", "dark").background;
const LOGO_WIDTH = 560;
const TITLE_WIDTH = CLIP_CONTENT.width - 60;

/** The last seconds of a clip: logo, book title and where to keep watching, inside the safe area. */
export const ClipEndCard: React.FC<{ bookTitle: string }> = ({ bookTitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
      <Stripes a={BACKGROUND} b={palette.plum} width={40} />
      <div
        style={{
          position: "absolute",
          left: CLIP_CONTENT.left,
          width: CLIP_CONTENT.width,
          top: CLIP_SAFE.top,
          height: CLIP_SAFE.bottom - CLIP_SAFE.top,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <svg
          viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
          width={LOGO_WIDTH}
          height={(LOGO_WIDTH * WORDMARK.height) / WORDMARK.width}
          style={{ overflow: "visible", scale: String(pop(0)) }}
        >
          <path d={WORDMARK.letters} fill={WORDMARK.onDark.letters} />
          <path d={WORDMARK.dot} fill={WORDMARK.onDark.dot} />
        </svg>
        <div
          style={{
            scale: String(pop(6)),
            rotate: "-2deg",
            maxWidth: TITLE_WIDTH,
            backgroundColor: palette.pink,
            padding: "10px 28px",
            boxShadow: `8px 8px 0 ${palette.ink}`,
            fontFamily: condensed,
            fontWeight: 700,
            fontSize: fitSize(bookTitle, TITLE_WIDTH - 56, { max: 66, min: 40, lines: 2 }),
            lineHeight: 1.12,
            color: palette.white,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          {bookTitle}
        </div>
        <div
          style={{
            scale: String(pop(12)),
            fontFamily: condensed,
            fontWeight: 700,
            fontSize: 62,
            lineHeight: 1.15,
            maxWidth: 2 * (CLIP_CONTENT.lowerRight - CLIP_CONTENT.centerX),
            color: palette.yellow,
            textAlign: "center",
          }}
        >
          Keep watching free on Mintsy
        </div>
      </div>
    </AbsoluteFill>
  );
};
