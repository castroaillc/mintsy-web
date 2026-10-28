import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { condensed, palette, Pop } from "../../collage/kit";

/* Prototype choreography for AI-illustrated scenes: times are seconds into each scene, from the narration's word timings. */

type Shot = {
  src: string;
  /** Where the camera drifts from and to, as fractions of the image (0–1) and zoom. */
  from: { x: number; y: number; zoom: number };
  to: { x: number; y: number; zoom: number };
};

/** One illustration with a slow camera move over the time it's on screen. */
const KenBurns: React.FC<{ shot: Shot; start: number; end: number }> = ({
  shot,
  start,
  end,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const zoom = shot.from.zoom + (shot.to.zoom - shot.from.zoom) * t;
  const fx = shot.from.x + (shot.to.x - shot.from.x) * t;
  const fy = shot.from.y + (shot.to.y - shot.from.y) * t;
  // Keep the focus point centred without showing past the image edges
  const maxX = (zoom - 1) / (2 * zoom);
  const maxY = maxX;
  const ox = Math.max(-maxX, Math.min(maxX, 0.5 - fx)) * width * zoom;
  const oy = Math.max(-maxY, Math.min(maxY, 0.5 - fy)) * height * zoom;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(shot.src)}
        style={{
          width,
          height,
          objectFit: "cover",
          scale: String(zoom),
          translate: `${ox}px ${oy}px`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Plays shots back to back, crossfading at each cut time (seconds). */
const Shots: React.FC<{ shots: Shot[]; cuts: number[] }> = ({
  shots,
  cuts,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const bounds = [0, ...cuts.map((c) => Math.round(c * fps)), durationInFrames];
  const fade = Math.round(0.5 * fps);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.ink }}>
      {shots.map((shot, i) => {
        const start = bounds[i];
        const end = bounds[i + 1];
        const opacity =
          i === 0
            ? 1
            : interpolate(frame, [start - fade / 2, start + fade / 2], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
        if (frame < start - fade) return null;
        return (
          <AbsoluteFill key={shot.src} style={{ opacity }}>
            <KenBurns shot={shot} start={start - fade} end={end} />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

/** Paper tag label that pops in on cue. */
const Tag: React.FC<{
  at: number;
  x: number;
  y: number;
  rotate?: number;
  color?: string;
  children: React.ReactNode;
}> = ({ at, x, y, rotate = -4, color = palette.cream, children }) => (
  <Pop at={at} x={x} y={y} rotate={rotate}>
    <div
      style={{
        backgroundColor: color,
        boxShadow: `5px 5px 0 rgba(30,27,36,0.85)`,
        padding: "6px 20px",
        fontFamily: condensed,
        fontWeight: 700,
        fontSize: 46,
        color: palette.ink,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  </Pop>
);

/** Shows its children only until `until` seconds, i.e. while the first shot is on screen. */
const UntilCut: React.FC<{ until: number; children: React.ReactNode }> = ({
  until,
  children,
}) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence durationInFrames={Math.round(until * fps)} layout="none">
      {children}
    </Sequence>
  );
};

/** Warm floating dust in the light. */
const Dust: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 26 }, (_, i) => {
        const x = (i * 197) % 1280;
        const y =
          (((i * 131) % 720) - frame * (0.15 + (i % 5) * 0.05) + 2000) % 720;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.sin((frame + i * 20) / 40) * 12,
              top: y,
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              borderRadius: "50%",
              backgroundColor: "rgba(255,236,190,0.55)",
              filter: "blur(0.6px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const IllManScene: React.FC = () => (
  <AbsoluteFill>
    <Shots
      cuts={[15.5]}
      shots={[
        {
          src: "illustrations/s1a.png",
          from: { x: 0.5, y: 0.5, zoom: 1.04 },
          to: { x: 0.74, y: 0.3, zoom: 1.35 },
        },
        {
          src: "illustrations/s1b.png",
          from: { x: 0.5, y: 0.55, zoom: 1.08 },
          to: { x: 0.45, y: 0.62, zoom: 1.3 },
        },
      ]}
    />
    <Dust />
    <UntilCut until={15.5}>
      <Tag at={12.4} x={1010} y={500}>
        Brand-new suit
      </Tag>
      <Tag at={14.0} x={1030} y={420} rotate={3} color={palette.pink}>
        Battered old hat
      </Tag>
    </UntilCut>
  </AbsoluteFill>
);

export const IllAdviceScene: React.FC = () => (
  <AbsoluteFill>
    <Shots
      cuts={[11.0]}
      shots={[
        {
          src: "illustrations/s3a.png",
          from: { x: 0.55, y: 0.5, zoom: 1.05 },
          to: { x: 0.62, y: 0.4, zoom: 1.3 },
        },
        {
          src: "illustrations/s3b.png",
          from: { x: 0.45, y: 0.5, zoom: 1.08 },
          to: { x: 0.52, y: 0.42, zoom: 1.4 },
        },
      ]}
    />
    <Dust />
    <UntilCut until={11.0}>
      <Tag at={5.4} x={300} y={170}>
        £85 a year
      </Tag>
      <Tag at={9.0} x={330} y={250} rotate={4}>
        8 shillings a week
      </Tag>
    </UntilCut>
    <Tag at={13.3} x={900} y={150} rotate={-3} color={palette.gold}>
      24 hours a day?
    </Tag>
  </AbsoluteFill>
);

export const IllMiracleScene: React.FC = () => (
  <AbsoluteFill>
    <Shots
      cuts={[16.8]}
      shots={[
        {
          src: "illustrations/s5a.png",
          from: { x: 0.6, y: 0.5, zoom: 1.05 },
          to: { x: 0.52, y: 0.6, zoom: 1.4 },
        },
        {
          src: "illustrations/s5b.png",
          from: { x: 0.5, y: 0.45, zoom: 1.2 },
          to: { x: 0.5, y: 0.5, zoom: 1.04 },
        },
      ]}
    />
    <Dust />
    <UntilCut until={16.8}>
      <Pop at={6.2} x={470} y={250}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            backgroundColor: palette.gold,
            border: `6px solid ${palette.ink}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: condensed,
            fontWeight: 700,
            fontSize: 62,
            color: palette.ink,
          }}
        >
          24
        </div>
      </Pop>
    </UntilCut>
    <Tag at={14.8} x={640} y={110} rotate={-2} color={palette.cream}>
      The perfect democracy
    </Tag>
  </AbsoluteFill>
);
