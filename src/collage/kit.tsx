import { collage } from "@mintsy/brand";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Prototype kit for a graphic-collage look: diagonal stripes, flat geometric figures,
 * condensed kinetic type, paper grain and a vignette.
 */

export const condensed = loadOswald("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
}).fontFamily;

export const palette = collage;

/** Frame number for a time in seconds. */
export function useAt() {
  const { fps } = useVideoConfig();
  return (sec: number) => Math.round(sec * fps);
}

/** 0→1 with a little overshoot, starting at `start` (frames). */
export function usePop(start: number, damping = 11) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - start,
    fps,
    config: { damping, stiffness: 170, mass: 0.7 },
  });
}

/** Pops a child in from `at` seconds: scale with overshoot, from slightly rotated. */
export const Pop: React.FC<{
  at: number;
  x: number;
  y: number;
  rotate?: number;
  children: React.ReactNode;
}> = ({ at, x, y, rotate = 0, children }) => {
  const p = usePop(useAt()(at));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        scale: String(p),
        rotate: `${rotate + (1 - Math.min(p, 1)) * -12}deg`,
        opacity: p > 0.01 ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
};

/** Full-frame diagonal stripes that slide slowly. */
export const Stripes: React.FC<{
  a: string;
  b: string;
  width?: number;
  opacity?: number;
}> = ({ a, b, width = 46, opacity = 1 }) => {
  const frame = useCurrentFrame();
  // Slide an oversized layer by less than one horizontal stripe period, so the pattern never shows a tile seam
  const period = width * 2 * Math.SQRT2;
  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: -period,
          right: 0,
          backgroundImage: `repeating-linear-gradient(-45deg, ${a} 0 ${width}px, ${b} ${width}px ${width * 2}px)`,
          translate: `${(frame * 0.6) % period}px 0`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Paper grain and a dark vignette, over everything. */
export const PaperFinish: React.FC<{ vignette?: number }> = ({ vignette = 0.55 }) => {
  const frame = useCurrentFrame();
  // Re-seed the grain a few times a second, like film
  const seed = Math.floor(frame / 4) % 8;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          mixBlendMode: "multiply",
          opacity: 0.35,
        }}
      >
        <filter id={`grain-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed={seed}
          />
          <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.55 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(20,12,8,${vignette}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Big stamped ✗ that slams in at `at` seconds. */
export const StampX: React.FC<{
  at: number;
  size?: number;
  color?: string;
}> = ({ at, size = 300, color = palette.pink }) => {
  const p = usePop(useAt()(at), 9);
  const bar: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: size * 1.25,
    height: size * 0.2,
    backgroundColor: color,
    translate: "-50% -50%",
  };
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        scale: String(1.6 - 0.6 * Math.min(p, 1)),
        opacity: Math.min(p * 2, 1),
      }}
    >
      <div style={{ ...bar, rotate: "45deg" }} />
      <div style={{ ...bar, rotate: "-45deg" }} />
    </div>
  );
};

/** Condensed caps line that slides up into place at `at` seconds. */
export const KineticLine: React.FC<{
  at: number;
  color?: string;
  size?: number;
  children: React.ReactNode;
  dot?: number;
  dotColor?: string;
}> = ({
  at,
  color = palette.white,
  size = 96,
  children,
  dot,
  dotColor = palette.pink,
}) => {
  const frame = useCurrentFrame();
  const start = useAt()(at);
  const p = interpolate(frame, [start, start + 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ overflow: "hidden", lineHeight: 1.02 }}>
      <div
        style={{
          fontFamily: condensed,
          fontWeight: 700,
          fontSize: size,
          color,
          textTransform: "uppercase",
          translate: `0 ${(1 - p) * 100}%`,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        {children}
        {dot !== undefined ? (
          <span
            style={{
              fontFamily: condensed,
              fontSize: size * 0.24,
              width: size * 0.36,
              height: size * 0.36,
              borderRadius: "50%",
              backgroundColor: dotColor,
              color: palette.white,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: size * 0.12,
            }}
          >
            {dot}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export type HatKind = "none" | "bowler" | "top" | "grad" | "crown" | "cap";
export type Mood = "neutral" | "happy" | "sad" | "surprised";

const Hat: React.FC<{ kind: HatKind }> = ({ kind }) => {
  switch (kind) {
    case "bowler":
      // Battered bowler: patched and dented
      return (
        <g transform="rotate(-9 60 26)">
          <rect x="18" y="22" width="84" height="10" rx="3" fill="#6B4A2E" />
          <path d="M34 24 L38 -6 L84 -2 L86 24 Z" fill="#7E5A38" />
          <rect
            x="40"
            y="2"
            width="14"
            height="10"
            fill="#B98A4E"
            transform="rotate(12 47 7)"
          />
          <path
            d="M70 -2 L76 8 L80 -1"
            stroke={palette.ink}
            strokeWidth="2"
            fill="none"
          />
        </g>
      );
    case "top":
      return (
        <g>
          <rect x="20" y="22" width="80" height="9" rx="3" fill={palette.ink} />
          <rect
            x="34"
            y="-30"
            width="52"
            height="54"
            rx="3"
            fill={palette.ink}
          />
          <rect x="34" y="12" width="52" height="7" fill={palette.pink} />
        </g>
      );
    case "grad":
      return (
        <g>
          <path d="M10 14 L60 -4 L110 14 L60 32 Z" fill={palette.ink} />
          <rect x="40" y="16" width="40" height="14" fill={palette.ink} />
          <path d="M104 14 L104 40" stroke={palette.yellow} strokeWidth="3" />
        </g>
      );
    case "crown":
      return (
        <g>
          <path
            d="M26 30 L22 -2 L42 14 L60 -10 L78 14 L98 -2 L94 30 Z"
            fill={palette.gold}
            stroke={palette.ink}
            strokeWidth="3"
          />
          <circle cx="60" cy="18" r="4" fill={palette.pink} />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M22 30 Q24 -4 60 -4 Q96 -4 98 30 Z" fill={palette.teal} />
          <path d="M84 26 L122 30 L84 34 Z" fill={palette.teal} />
          <circle cx="60" cy="-4" r="4" fill={palette.ink} />
        </g>
      );
    default:
      return null;
  }
};

const Mouth: React.FC<{ mood: Mood }> = ({ mood }) => {
  switch (mood) {
    case "happy":
      return (
        <path
          d="M49 78 Q60 90 71 78"
          stroke={palette.ink}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "sad":
      return (
        <path
          d="M50 86 Q60 76 70 86"
          stroke={palette.ink}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "surprised":
      return <ellipse cx="60" cy="83" rx="6" ry="8" fill={palette.ink} />;
    default:
      return (
        <rect
          x="52"
          y="80"
          width="16"
          height="3"
          rx="1.5"
          fill={palette.ink}
          opacity="0.7"
        />
      );
  }
};

/**
 * Geometric puppet: circle head, dot eyes that blink, rectangle body, stick legs.
 * Drawn in a 120×300 box; the hat, outfit and mood change who it is.
 */
export const Figure: React.FC<{
  body?: string;
  hat?: HatKind;
  mood?: Mood;
  hatAt?: number;
  scale?: number;
  blinkOffset?: number;
}> = ({
  body = palette.slate,
  hat = "none",
  mood = "neutral",
  hatAt = 0,
  scale = 1,
  blinkOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hatPop = usePop(Math.round(hatAt * fps), 8);
  // Blink for 3 frames every ~3.3s; idle sway keeps the puppet alive
  const blinking = (frame + blinkOffset) % 100 < 3;
  const sway = Math.sin((frame + blinkOffset) / 18) * 2;
  return (
    <svg
      width={120 * scale}
      height={300 * scale}
      viewBox="0 0 120 300"
      style={{
        overflow: "visible",
        rotate: `${sway}deg`,
        transformOrigin: "50% 100%",
      }}
    >
      <rect x="44" y="200" width="12" height="92" rx="6" fill={palette.skin} />
      <rect x="64" y="200" width="12" height="92" rx="6" fill={palette.skin} />
      <rect x="28" y="100" width="64" height="110" rx="10" fill={body} />
      {/* Lapels make any body color read as a suit */}
      <path
        d="M60 100 L48 140 L60 128 L72 140 Z"
        fill={palette.white}
        opacity="0.9"
      />
      <circle cx="60" cy="62" r="40" fill={palette.skin} />
      {blinking ? (
        <>
          <rect
            x="42"
            y="61"
            width="12"
            height="3"
            rx="1.5"
            fill={palette.ink}
          />
          <rect
            x="66"
            y="61"
            width="12"
            height="3"
            rx="1.5"
            fill={palette.ink}
          />
        </>
      ) : (
        <>
          <circle
            cx="48"
            cy="62"
            r={mood === "surprised" ? 6.5 : 5}
            fill={palette.ink}
          />
          <circle
            cx="72"
            cy="62"
            r={mood === "surprised" ? 6.5 : 5}
            fill={palette.ink}
          />
        </>
      )}
      <Mouth mood={mood} />
      {hat !== "none" ? (
        <g
          style={{
            transformBox: "fill-box",
            transformOrigin: "50% 100%",
            scale: String(hatPop),
            translate: `0 ${(1 - Math.min(hatPop, 1)) * -40}px`,
          }}
        >
          <Hat kind={hat} />
        </g>
      ) : null}
    </svg>
  );
};

/** Off-white card with a hard offset shadow, like a pasted paper cut-out. */
export const Cutout: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  color?: string;
}> = ({ children, style, color = palette.cream }) => (
  <div
    style={{
      backgroundColor: color,
      boxShadow: `10px 10px 0 ${palette.ink}`,
      ...style,
    }}
  >
    {children}
  </div>
);
