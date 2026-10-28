import { createContext, useContext } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { ICONS } from "./icons";
import type { IconName } from "./iconNames";
import {
  condensed,
  Cutout,
  Figure,
  KineticLine,
  palette,
  Pop,
  StampX,
  useAt,
  usePop,
} from "./kit";
import type { Beat, Prop } from "./schema";

type Of<T extends Beat["layout"]> = Extract<Beat, { layout: T }>;

/** Cue times for the current scene, so any element can find when it should appear. */
export const CueContext = createContext<Record<string, number>>({});

/** Seconds into the scene at which `cue` is spoken; staggered after the beat start if it isn't found. */
function useCueSec() {
  const cues = useContext(CueContext);
  return (cue: string, beatStart: number, index: number) => {
    const at = cues[cue] ?? beatStart + 0.4 + index * 0.8;
    // A beat's first element shows as it slides in, so the frame is never just stripes
    return index === 0 ? Math.min(at, beatStart + 0.4) : at;
  };
}

export const COLORS = palette;

function iconFor(name: string) {
  return ICONS[name as IconName] ?? ICONS.star;
}

/** Text and panel colors that read on each stripe background. */
export const BACKGROUNDS = {
  mint: { a: palette.mint, b: palette.teal, ink: palette.white, busy: true },
  pink: { a: palette.pink, b: palette.yellow, ink: palette.white, busy: true },
  plum: { a: palette.plum, b: "#3A2C66", ink: palette.white, busy: false },
  cream: { a: palette.cream, b: "#EAD3A6", ink: palette.ink, busy: false },
  slate: { a: palette.slate, b: "#4A6663", ink: palette.white, busy: false },
} as const;
export type BackgroundName = keyof typeof BACKGROUNDS;

const TapeLabel: React.FC<{ text: string; color?: string; size?: number }> = ({
  text,
  color = palette.cream,
  size = 30,
}) => (
  <div
    style={{
      backgroundColor: color,
      boxShadow: `4px 4px 0 ${palette.ink}`,
      padding: "2px 14px",
      fontFamily: condensed,
      fontWeight: 700,
      fontSize: size,
      color:
        color === palette.cream ||
        color === palette.yellow ||
        color === palette.gold
          ? palette.ink
          : palette.white,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

/** One prop: an icon on a paper sticker, or a puppet figure, with an optional label. */
export const PropView: React.FC<{
  prop: Prop;
  size?: number;
  at: number;
  blinkOffset?: number;
}> = ({ prop, size = 1, at, blinkOffset = 0 }) => {
  if (prop.kind === "figure") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Figure
          body={palette[prop.outfit]}
          hat={prop.hat}
          mood={prop.mood}
          hatAt={at + 0.25}
          scale={0.85 * size}
          blinkOffset={blinkOffset}
        />
        {prop.label ? <TapeLabel text={prop.label} /> : null}
      </div>
    );
  }
  const IconComponent = iconFor(prop.icon);
  const edge = 150 * size;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: edge,
          height: edge,
          borderRadius: "50%",
          backgroundColor: palette.cream,
          border: `6px solid ${palette.ink}`,
          boxShadow: `8px 8px 0 ${palette.ink}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconComponent
          size={edge * 0.6}
          weight="fill"
          color={palette[prop.color]}
        />
      </div>
      {prop.label ? <TapeLabel text={prop.label} /> : null}
    </div>
  );
};

/** Slot centres for 1–5 props on the stage card, centrepiece first; rows clear the caption tape. */
const STAGE_SLOTS: [number, number][][] = [
  [[640, 420]],
  [
    [500, 420],
    [790, 420],
  ],
  [
    [640, 410],
    [380, 450],
    [900, 450],
  ],
  [
    [640, 410],
    [380, 500],
    [900, 500],
    [380, 290],
  ],
  [
    [640, 410],
    [380, 505],
    [900, 505],
    [380, 290],
    [900, 290],
  ],
];

const StageBeat: React.FC<{ beat: Of<"stage">; start: number }> = ({
  beat,
  start,
}) => {
  const cueSec = useCueSec();
  const props = beat.props.slice(0, 5);
  const slots = STAGE_SLOTS[props.length - 1] ?? STAGE_SLOTS[0];
  return (
    <AbsoluteFill>
      <Pop at={start} x={640} y={415}>
        <Cutout style={{ width: 900, height: 480, borderRadius: 4 }} />
      </Pop>
      {props.map((prop, i) => (
        <Pop
          key={i}
          at={cueSec(prop.cue, start, i)}
          x={slots[i][0]}
          y={slots[i][1]}
        >
          <PropView
            prop={prop}
            at={cueSec(prop.cue, start, i)}
            size={i === 0 ? (props.length > 3 ? 1 : 1.15) : 0.75}
            blinkOffset={i * 31}
          />
        </Pop>
      ))}
      {beat.caption ? (
        <Pop at={cueSec(beat.captionCue, start, 0)} x={640} y={125} rotate={-3}>
          <div
            style={{
              whiteSpace: "nowrap",
              backgroundColor: palette.pink,
              padding: "4px 26px",
              boxShadow: `6px 6px 0 ${palette.ink}`,
            }}
          >
            <KineticLine
              at={cueSec(beat.captionCue, start, 0) + 0.05}
              size={beat.caption.length > 18 ? 48 : 60}
            >
              {beat.caption}
            </KineticLine>
          </div>
        </Pop>
      ) : null}
    </AbsoluteFill>
  );
};

/** Text with its highlight phrase colored. */
function highlighted(text: string, highlight: string, color: string) {
  const at = highlight
    ? text.toLowerCase().indexOf(highlight.toLowerCase())
    : -1;
  if (at < 0) return text;
  return (
    <span>
      {text.slice(0, at)}
      <span style={{ color }}>{text.slice(at, at + highlight.length)}</span>
      {text.slice(at + highlight.length)}
    </span>
  );
}

const HIGHLIGHTS = [palette.pink, palette.yellow, palette.mint];

const HeadlineBeat: React.FC<{
  beat: Of<"headline">;
  start: number;
  background: BackgroundName;
}> = ({ beat, start, background }) => {
  const cueSec = useCueSec();
  const frame = useCurrentFrame();
  const at = useAt();
  const bg = BACKGROUNDS[background];
  const lines = beat.lines.slice(0, 3);
  const size = lines.length === 1 ? 96 : 76;
  // Earlier lines dim when the stamp lands, so the last line carries the point
  const stampSec = beat.stamp ? cueSec(beat.stamp.cue, start, lines.length) : 0;
  const dim = beat.stamp
    ? interpolate(frame, [at(stampSec) - 6, at(stampSec)], [1, 0.4], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const text = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {lines.map((line, i) => (
        <div key={i} style={{ opacity: i < lines.length - 1 ? dim : 1 }}>
          <KineticLine
            at={cueSec(line.cue, start, i)}
            size={size}
            color={bg.busy ? palette.white : bg.ink}
            dot={beat.numbered ? i + 1 : undefined}
            dotColor={HIGHLIGHTS[i % 3]}
          >
            {highlighted(
              line.text,
              line.highlight,
              HIGHLIGHTS[i % 3] === palette.yellow &&
                !bg.busy &&
                bg.ink === palette.ink
                ? palette.pink
                : HIGHLIGHTS[i % 3],
            )}
          </KineticLine>
        </div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 110px" }}>
      {/* On busy stripes, the text sits on an ink slab */}
      {bg.busy ? (
        <Pop at={start} x={640} y={360} rotate={-1.5}>
          <Cutout
            color={palette.ink}
            style={{
              padding: "40px 56px",
              maxWidth: 1060,
              boxShadow: `10px 10px 0 ${palette.cream}`,
            }}
          >
            {text}
          </Cutout>
        </Pop>
      ) : (
        text
      )}
      {beat.stamp ? (
        <Pop
          at={stampSec}
          x={bg.busy ? 820 : 760}
          y={bg.busy ? 560 : 590}
          rotate={-6}
        >
          <div
            style={{
              border: `7px solid ${palette.pink}`,
              color: palette.pink,
              fontFamily: condensed,
              fontWeight: 700,
              fontSize: 54,
              padding: "2px 22px",
              letterSpacing: 3,
              backgroundColor: "rgba(30,27,36,0.8)",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {beat.stamp.text}
          </div>
        </Pop>
      ) : null}
    </AbsoluteFill>
  );
};

const CounterBeat: React.FC<{
  beat: Of<"counter">;
  start: number;
  background: BackgroundName;
}> = ({ beat, start, background }) => {
  const cueSec = useCueSec();
  const frame = useCurrentFrame();
  const at = useAt();
  const bg = BACKGROUNDS[background];
  const countAt = at(cueSec(beat.cue, start, 1));
  const count = interpolate(frame, [countAt, countAt + 45], [0, beat.value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const decimals = Number.isInteger(beat.value) ? 0 : 1;
  const badge = usePop(countAt);
  const IconComponent = iconFor(beat.icon);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 120, width: 460 }}>
        {beat.title
          .split(" ")
          .reduce<string[]>((rows, word) => {
            // Two words per line keeps the title chunky
            if (rows.length && rows[rows.length - 1].split(" ").length < 2)
              rows[rows.length - 1] += ` ${word}`;
            else rows.push(word);
            return rows;
          }, [])
          .map((row, i) => (
            <KineticLine
              key={i}
              at={start + 0.2 + i * 0.2}
              size={80}
              color={i % 2 ? palette.pink : bg.busy ? palette.white : bg.ink}
            >
              {row}
            </KineticLine>
          ))}
      </div>
      <Pop at={start + 0.1} x={850} y={360}>
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: "50%",
            backgroundColor: palette.cream,
            border: `8px solid ${palette.ink}`,
            boxShadow: `12px 12px 0 ${palette.ink}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconComponent size={230} weight="fill" color={palette[beat.color]} />
        </div>
      </Pop>
      <div
        style={{
          position: "absolute",
          left: 850,
          top: 560,
          translate: "-50% 0",
          scale: String(badge),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            backgroundColor: palette.gold,
            border: `6px solid ${palette.ink}`,
            boxShadow: `6px 6px 0 ${palette.ink}`,
            padding: "0 26px",
            fontFamily: condensed,
            fontWeight: 700,
            fontSize: 84,
            color: palette.ink,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {beat.prefix}
          {count.toLocaleString("en-GB", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}
          {beat.suffix}
        </div>
      </div>
      <Pop at={cueSec(beat.cue, start, 1) + 0.6} x={340} y={560} rotate={-2}>
        <TapeLabel text={beat.label} size={38} />
      </Pop>
    </AbsoluteFill>
  );
};

const LineupBeat: React.FC<{
  beat: Of<"lineup">;
  start: number;
  background: BackgroundName;
}> = ({ beat, start, background }) => {
  const cueSec = useCueSec();
  const bg = BACKGROUNDS[background];
  const members = beat.members.slice(0, 4);
  const gap = 1080 / members.length;
  const badgeSec = beat.badge
    ? cueSec(beat.badgeCue, start, members.length)
    : 0;
  return (
    <AbsoluteFill>
      {beat.heading ? (
        <div style={{ position: "absolute", left: 100, top: 70 }}>
          <KineticLine
            at={start + 0.1}
            size={64}
            color={bg.busy ? palette.white : bg.ink}
          >
            {beat.heading}
          </KineticLine>
        </div>
      ) : null}
      {members.map((member, i) => {
        const x = 100 + gap * (i + 0.5);
        return (
          <div key={i}>
            <Pop at={cueSec(member.cue, start, i)} x={x} y={420}>
              <PropView
                size={1.25}
                prop={member}
                at={cueSec(member.cue, start, i)}
                blinkOffset={i * 37}
              />
            </Pop>
            {beat.badge ? (
              <Pop at={badgeSec + i * 0.12} x={x + 70} y={215}>
                <div
                  style={{
                    minWidth: 92,
                    height: 92,
                    padding: "0 14px",
                    borderRadius: 46,
                    backgroundColor: palette.gold,
                    border: `5px solid ${palette.ink}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: condensed,
                    fontWeight: 700,
                    fontSize: 44,
                    color: palette.ink,
                    whiteSpace: "nowrap",
                  }}
                >
                  {beat.badge}
                </div>
              </Pop>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Pops in place (inside a flow layout) at `at` seconds. */
const InlinePop: React.FC<{ at: number; children: React.ReactNode }> = ({
  at,
  children,
}) => {
  const p = usePop(useAt()(at));
  return (
    <div
      style={{
        scale: String(p),
        transformOrigin: "0 50%",
        opacity: p > 0.01 ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
};

const VersusBeat: React.FC<{ beat: Of<"versus">; start: number }> = ({
  beat,
  start,
}) => {
  const cueSec = useCueSec();
  const verdictSec =
    beat.winner !== "none" ? cueSec(beat.verdictCue, start, 6) : 0;
  const side = (
    s: Of<"versus">["left"],
    x: number,
    offset: number,
    which: "left" | "right",
  ) => {
    const won = beat.winner === which;
    const lost = beat.winner !== "none" && !won;
    return (
      <Pop
        at={start + offset}
        x={x}
        y={380}
        rotate={which === "left" ? -1.5 : 1.5}
      >
        <div style={{ position: "relative" }}>
          <Cutout
            style={{
              width: 500,
              height: 520,
              padding: "26px 34px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: condensed,
                fontWeight: 700,
                fontSize: 52,
                color: palette.ink,
                textTransform: "uppercase",
              }}
            >
              {s.label}
            </div>
            <div style={{ height: 210, display: "flex", alignItems: "center" }}>
              <PropView
                prop={{ ...s.prop, label: "" }}
                at={start + offset}
                size={0.85}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                alignSelf: "stretch",
              }}
            >
              {s.points.slice(0, 3).map((point, i) => (
                <InlinePop key={i} at={cueSec(point.cue, start, i + 1)}>
                  <div
                    style={{
                      fontFamily: condensed,
                      fontWeight: 500,
                      fontSize: 32,
                      color: palette.ink,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    • {point.text}
                  </div>
                </InlinePop>
              ))}
            </div>
          </Cutout>
          {lost ? (
            <div style={{ position: "absolute", inset: 0 }}>
              <StampX at={verdictSec} size={300} />
            </div>
          ) : null}
          {won ? (
            <Pop at={verdictSec} x={470} y={20}>
              <div
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: "50%",
                  backgroundColor: palette.teal,
                  border: `6px solid ${palette.ink}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <path
                    d="M10 32 L25 46 L50 14"
                    stroke={palette.white}
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Pop>
          ) : null}
        </div>
      </Pop>
    );
  };
  return (
    <AbsoluteFill>
      {side(beat.left, 355, 0, "left")}
      {side(beat.right, 925, 0.25, "right")}
    </AbsoluteFill>
  );
};

const TakeawaysBeat: React.FC<{ beat: Of<"takeaways">; start: number }> = ({
  beat,
  start,
}) => {
  const cueSec = useCueSec();
  return (
    <AbsoluteFill>
      <Pop at={start} x={640} y={110} rotate={-2}>
        <div
          style={{
            backgroundColor: palette.pink,
            padding: "4px 30px",
            boxShadow: `6px 6px 0 ${palette.ink}`,
          }}
        >
          <KineticLine at={start + 0.05} size={64}>
            {beat.heading}
          </KineticLine>
        </div>
      </Pop>
      {beat.items.slice(0, 3).map((item, i) => (
        <Pop
          key={i}
          at={cueSec(item.cue, start, i)}
          x={640}
          y={270 + i * 140}
          rotate={i % 2 ? 1.2 : -1.2}
        >
          <Cutout
            style={{
              width: 900,
              padding: "18px 30px",
              display: "flex",
              alignItems: "center",
              gap: 26,
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                backgroundColor: HIGHLIGHTS[i],
                border: `5px solid ${palette.ink}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: condensed,
                fontWeight: 700,
                fontSize: 40,
                color: palette.ink,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                fontFamily: condensed,
                fontWeight: 700,
                fontSize: 46,
                color: palette.ink,
                textTransform: "uppercase",
              }}
            >
              {item.text}
            </div>
          </Cutout>
        </Pop>
      ))}
    </AbsoluteFill>
  );
};

export const BeatView: React.FC<{
  beat: Beat;
  start: number;
  background: BackgroundName;
}> = ({ beat, start, background }) => {
  switch (beat.layout) {
    case "stage":
      return <StageBeat beat={beat} start={start} />;
    case "headline":
      return <HeadlineBeat beat={beat} start={start} background={background} />;
    case "counter":
      return <CounterBeat beat={beat} start={start} background={background} />;
    case "lineup":
      return <LineupBeat beat={beat} start={start} background={background} />;
    case "versus":
      return <VersusBeat beat={beat} start={start} />;
    case "takeaways":
      return <TakeawaysBeat beat={beat} start={start} />;
  }
};
