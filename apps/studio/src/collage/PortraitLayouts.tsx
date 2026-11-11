/**
 * The six layouts for vertical clips, from the same beats as Layouts.tsx. They're laid out in flow
 * inside CLIP_CONTENT, so longer text moves its neighbours instead of colliding. Bare text never
 * sits on stripes here: it's on an ink slab, a paper card or tape, so it reads on every background.
 */
import { interpolate, useCurrentFrame } from "remotion";

import { CLIP_CONTENT, fitSize } from "./clipLayout";
import { condensed, Cutout, KineticLine, palette, StampX, useAt, usePop } from "./kit";
import { type BackgroundName, HIGHLIGHTS, highlighted, iconFor, PropView, TapeLabel, useCueSec } from "./Layouts";
import type { Beat, Prop } from "./schema";

type Of<T extends Beat["layout"]> = Extract<Beat, { layout: T }>;

const { left: LEFT, top: TOP, bottom: BOTTOM, width: WIDTH, lowerRight: LOWER_RIGHT, lowerFrom: LOWER_FROM } = CLIP_CONTENT;
const LOWER_WIDTH = LOWER_RIGHT - LEFT;
/** The content area, as a centred column. */
const Column: React.FC<{ children: React.ReactNode; gap?: number; upper?: boolean; justify?: React.CSSProperties["justifyContent"] }> = ({ children, gap = 24, upper = false, justify = "center" }) => (
  <div
    style={{
      position: "absolute",
      left: LEFT,
      top: TOP,
      width: WIDTH,
      // Upper: stays above the line where the action column starts, so it can use the full width
      height: (upper ? LOWER_FROM : BOTTOM) - TOP,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: justify,
      gap,
    }}
  >
    {children}
  </div>
);

/** Pops in where the flow puts it. Keeps its space before it appears, so nothing shifts. */
const FlowPop: React.FC<{ at: number; rotate?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, rotate = 0, style, children }) => {
  const p = usePop(useAt()(at));
  return (
    <div
      style={{
        scale: String(p),
        rotate: `${rotate + (1 - Math.min(p, 1)) * -8}deg`,
        opacity: p > 0.01 ? 1 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** White condensed type on an ink slab: readable on every background, including the busy stripes. */
const Slab: React.FC<{ text: string; at: number; size: number; rotate?: number }> = ({ text, at, size, rotate = -1.5 }) => (
  <FlowPop at={at} rotate={rotate}>
    <Cutout color={palette.ink} style={{ padding: "12px 28px", maxWidth: WIDTH, boxShadow: `8px 8px 0 ${palette.cream}` }}>
      <div style={{ fontFamily: condensed, fontWeight: 700, fontSize: size, lineHeight: 1.08, color: palette.white, textTransform: "uppercase", textAlign: "center" }}>{text}</div>
    </Cutout>
  </FlowPop>
);

const headingSize = (text: string, lines = 2) => fitSize(text, WIDTH - 56, { max: 66, min: 42, lines });

const PortraitProp: React.FC<{ prop: Prop; at: number; size: number; labelWidth: number; blinkOffset?: number }> = ({ prop, at, size, labelWidth, blinkOffset }) => (
  <PropView
    prop={prop}
    at={at}
    // A figure is much taller than an icon at the same scale
    size={prop.kind === "figure" ? size * 0.78 : size}
    blinkOffset={blinkOffset}
    labelMaxWidth={labelWidth}
    labelSize={prop.label ? fitSize(prop.label, labelWidth - 28, { max: 38, min: 26, lines: 2 }) : undefined}
  />
);

/** A wrapping grid of equal cells; lower rows stay left of the lower right edge. */
const Grid: React.FC<{ columns: number; full?: boolean; children: React.ReactNode }> = ({ columns, full = false, children }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, width: full ? WIDTH : LOWER_WIDTH, alignSelf: "flex-start", rowGap: 16, justifyItems: "center", alignItems: "end" }}>{children}</div>
);

// Prop scale and label width by how many share the space: [columns, first prop, others, label width]
const STAGE_FIT: Record<number, [number, number, number, number]> = {
  1: [1, 1.7, 1.7, 560],
  2: [2, 1.3, 1.3, 320],
  3: [2, 0.85, 0.85, 280],
  4: [2, 0.85, 0.85, 280],
  5: [3, 0.8, 0.8, 190],
};

const StageBeat: React.FC<{ beat: Of<"stage">; start: number }> = ({ beat, start }) => {
  const cueSec = useCueSec();
  const props = beat.props.slice(0, 5);
  const [columns, first, others, labelWidth] = STAGE_FIT[props.length] ?? STAGE_FIT[1];
  return (
    <Column gap={20}>
      {beat.caption ? (
        <FlowPop at={cueSec(beat.captionCue, start, 0)} rotate={-2} style={{ zIndex: 1, marginBottom: -44 }}>
          <div style={{ backgroundColor: palette.pink, padding: "6px 26px", boxShadow: `6px 6px 0 ${palette.ink}`, maxWidth: WIDTH }}>
            <KineticLine at={cueSec(beat.captionCue, start, 0) + 0.05} size={fitSize(beat.caption, WIDTH - 52, { max: 68, min: 42 })}>
              {beat.caption}
            </KineticLine>
          </div>
        </FlowPop>
      ) : null}
      <FlowPop at={start} style={{ width: WIDTH, flexShrink: 0 }}>
        <Cutout style={{ width: WIDTH, minHeight: 400, borderRadius: 4, padding: "58px 0 18px", display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
          <div style={{ marginLeft: 0 }}>
            <Grid columns={columns} full={props.length <= 2}>
              {props.map((prop, i) => (
                <FlowPop key={i} at={cueSec(prop.cue, start, i)} style={props.length === 3 && i === 0 ? { gridColumn: "1 / span 2" } : undefined}>
                  <PortraitProp prop={prop} at={cueSec(prop.cue, start, i)} size={i === 0 ? first : others} labelWidth={labelWidth} blinkOffset={i * 31} />
                </FlowPop>
              ))}
            </Grid>
          </div>
        </Cutout>
      </FlowPop>
    </Column>
  );
};

const NUMBER_SIZE = 56;

const HeadlineBeat: React.FC<{ beat: Of<"headline">; start: number }> = ({ beat, start }) => {
  const cueSec = useCueSec();
  const frame = useCurrentFrame();
  const at = useAt();
  const lines = beat.lines.slice(0, 3);
  const inner = WIDTH - 72 - (beat.numbered ? NUMBER_SIZE + 16 : 0);
  // One size for every line: the largest whose wrapped lines all stay above the action column
  const room = LOWER_FROM - TOP - 72 - (lines.length - 1) * 18;
  const rows = (size: number) => lines.reduce((sum, l) => sum + Math.ceil((l.text.length * size * 0.52 * 1.08) / inner), 0);
  let size = lines.length === 1 ? 120 : 92;
  while (size > 48 && rows(size) * size * 1.02 > room) size -= 2;
  const stampSec = beat.stamp ? cueSec(beat.stamp.cue, start, lines.length) : 0;
  const dim = beat.stamp ? interpolate(frame, [at(stampSec) - 6, at(stampSec)], [1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <Column gap={30} upper={!beat.stamp} justify={beat.stamp ? "flex-start" : "center"}>
      <FlowPop at={start} rotate={-1}>
        <Cutout color={palette.ink} style={{ width: WIDTH, padding: "36px 36px", boxShadow: `10px 10px 0 ${palette.cream}`, display: "flex", flexDirection: "column", gap: 18 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ opacity: i < lines.length - 1 ? dim : 1, display: "flex", alignItems: "flex-start", gap: 16 }}>
              {beat.numbered ? (
                <FlowPop at={cueSec(line.cue, start, i)} style={{ flexShrink: 0, marginTop: Math.max(0, (size - NUMBER_SIZE) / 2) }}>
                  <div
                    style={{
                      width: NUMBER_SIZE,
                      height: NUMBER_SIZE,
                      borderRadius: "50%",
                      backgroundColor: HIGHLIGHTS[i % 3],
                      color: palette.ink,
                      fontFamily: condensed,
                      fontWeight: 700,
                      fontSize: 34,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i + 1}
                  </div>
                </FlowPop>
              ) : null}
              <KineticLine at={cueSec(line.cue, start, i)} size={size} color={palette.white}>
                {highlighted(line.text, line.highlight, HIGHLIGHTS[i % 3])}
              </KineticLine>
            </div>
          ))}
        </Cutout>
      </FlowPop>
      {beat.stamp ? (
        <FlowPop at={stampSec} rotate={-5} style={{ alignSelf: "flex-start", marginLeft: 20 }}>
          <div
            style={{
              border: `7px solid ${palette.pink}`,
              color: palette.pink,
              fontFamily: condensed,
              fontWeight: 700,
              fontSize: fitSize(beat.stamp.text, LOWER_WIDTH - 90, { max: 62, min: 38 }),
              padding: "2px 22px",
              letterSpacing: 3,
              backgroundColor: "rgba(30,27,36,0.92)",
              textTransform: "uppercase",
            }}
          >
            {beat.stamp.text}
          </div>
        </FlowPop>
      ) : null}
    </Column>
  );
};

const CounterBeat: React.FC<{ beat: Of<"counter">; start: number }> = ({ beat, start }) => {
  const cueSec = useCueSec();
  const frame = useCurrentFrame();
  const at = useAt();
  const countAt = at(cueSec(beat.cue, start, 1));
  const count = interpolate(frame, [countAt, countAt + 45], [0, beat.value], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const decimals = Number.isInteger(beat.value) ? 0 : 1;
  const badge = usePop(countAt);
  const IconComponent = iconFor(beat.icon);
  const finalNumber = `${beat.prefix}${beat.value.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${beat.suffix}`;
  return (
    <Column gap={22}>
      <Slab text={beat.title} at={start + 0.1} size={headingSize(beat.title)} />
      <FlowPop at={start + 0.1}>
        <div
          style={{
            width: 210,
            height: 210,
            borderRadius: "50%",
            backgroundColor: palette.cream,
            border: `8px solid ${palette.ink}`,
            boxShadow: `10px 10px 0 ${palette.ink}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconComponent size={126} weight="fill" color={palette[beat.color]} />
        </div>
      </FlowPop>
      <div
        style={{
          alignSelf: "flex-start",
          width: LOWER_WIDTH,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            scale: String(badge),
            backgroundColor: palette.gold,
            border: `6px solid ${palette.ink}`,
            boxShadow: `6px 6px 0 ${palette.ink}`,
            padding: "0 26px",
            fontFamily: condensed,
            fontWeight: 700,
            fontSize: fitSize(finalNumber, LOWER_WIDTH - 64, { max: 88, min: 50 }),
            color: palette.ink,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {beat.prefix}
          {count.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
          {beat.suffix}
        </div>
        <FlowPop at={cueSec(beat.cue, start, 1) + 0.6} rotate={-2}>
          <TapeLabel text={beat.label} size={fitSize(beat.label, LOWER_WIDTH - 40, { max: 40, min: 30, lines: 2 })} maxWidth={LOWER_WIDTH} />
        </FlowPop>
      </div>
    </Column>
  );
};

// Columns, prop scale and label width by member count
const LINEUP_FIT: Record<number, [number, number, number]> = {
  2: [2, 1.45, 320],
  3: [3, 1.05, 225],
  4: [2, 0.72, 290],
};

const LineupBeat: React.FC<{ beat: Of<"lineup">; start: number }> = ({ beat, start }) => {
  const cueSec = useCueSec();
  const members = beat.members.slice(0, 4);
  const [columns, size, labelWidth] = LINEUP_FIT[members.length] ?? LINEUP_FIT[4];
  const badgeSec = beat.badge ? cueSec(beat.badgeCue, start, members.length) : 0;
  return (
    <Column gap={24} upper={members.length < 4}>
      {beat.heading ? <Slab text={beat.heading} at={start + 0.1} size={headingSize(beat.heading, members.length < 4 ? 2 : 1)} /> : null}
      <Grid columns={columns} full={members.length < 4}>
        {members.map((member, i) => (
          <div key={i} style={{ position: "relative" }}>
            <FlowPop at={cueSec(member.cue, start, i)}>
              <PortraitProp prop={member} at={cueSec(member.cue, start, i)} size={size} labelWidth={labelWidth} blinkOffset={i * 37} />
            </FlowPop>
            {beat.badge ? (
              <FlowPop at={badgeSec + i * 0.12} style={{ position: "absolute", top: -10, right: -24 }}>
                <div
                  style={{
                    minWidth: 76,
                    height: 76,
                    padding: "0 12px",
                    borderRadius: 38,
                    backgroundColor: palette.gold,
                    border: `5px solid ${palette.ink}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: condensed,
                    fontWeight: 700,
                    fontSize: 38,
                    color: palette.ink,
                    whiteSpace: "nowrap",
                  }}
                >
                  {beat.badge}
                </div>
              </FlowPop>
            ) : null}
          </div>
        ))}
      </Grid>
    </Column>
  );
};

const PANEL_TEXT_WIDTH = 480;
const VersusBeat: React.FC<{ beat: Of<"versus">; start: number }> = ({ beat, start }) => {
  const cueSec = useCueSec();
  const verdictSec = beat.winner !== "none" ? cueSec(beat.verdictCue, start, 6) : 0;
  const everyPoint = [...beat.left.points, ...beat.right.points].slice(0, 6).map((p) => p.text);
  const longest = everyPoint.reduce((a, t) => (t.length > a.length ? t : a), "");
  // Text stays left of the action column; only the prop at the panel's right may sit under it
  const textWidth = PANEL_TEXT_WIDTH;
  const pointSize = fitSize(`• ${longest}`, textWidth, { max: 40, min: 30 });
  const side = (s: Of<"versus">["left"], offset: number, which: "left" | "right") => {
    const won = beat.winner === which;
    const lost = beat.winner !== "none" && !won;
    return (
      <FlowPop at={start + offset} rotate={which === "left" ? -1 : 1} style={{ position: "relative" }}>
        <Cutout style={{ width: WIDTH, height: 312, padding: "12px 20px 12px 34px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: textWidth, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: condensed, fontWeight: 700, fontSize: fitSize(s.label, textWidth, { max: 58, min: 36 }), lineHeight: 1.1, color: palette.ink, textTransform: "uppercase" }}>{s.label}</div>
            {s.points.slice(0, 3).map((point, i) => (
              <FlowPop key={i} at={cueSec(point.cue, start, i + 1)} style={{ transformOrigin: "0 50%" }}>
                <div style={{ fontFamily: condensed, fontWeight: 500, fontSize: pointSize, lineHeight: 1.15, color: palette.ink, textTransform: "uppercase" }}>• {point.text}</div>
              </FlowPop>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <PropView prop={{ ...s.prop, label: "" }} at={start + offset} size={s.prop.kind === "figure" ? 0.8 : 0.9} />
          </div>
        </Cutout>
        {lost ? (
          // Over the prop, so the crossed-out side can still be read
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 200 }}>
            <StampX at={verdictSec} size={130} />
          </div>
        ) : null}
        {won ? (
          <FlowPop at={verdictSec} style={{ position: "absolute", top: -22, right: -14 }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", backgroundColor: palette.teal, border: `6px solid ${palette.ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="54" height="54" viewBox="0 0 60 60">
                <path d="M10 32 L25 46 L50 14" stroke={palette.white} strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </FlowPop>
        ) : null}
      </FlowPop>
    );
  };
  return (
    <Column gap={30}>
      {side(beat.left, 0, "left")}
      {side(beat.right, 0.25, "right")}
    </Column>
  );
};

const TakeawaysBeat: React.FC<{ beat: Of<"takeaways">; start: number }> = ({ beat, start }) => {
  const cueSec = useCueSec();
  const textWidth = LOWER_RIGHT - LEFT - 134;
  return (
    <Column gap={22}>
      <FlowPop at={start} rotate={-2} style={{ marginBottom: 4 }}>
        <div style={{ backgroundColor: palette.pink, padding: "6px 28px", boxShadow: `6px 6px 0 ${palette.ink}`, maxWidth: WIDTH }}>
          <div style={{ fontFamily: condensed, fontWeight: 700, fontSize: headingSize(beat.heading), lineHeight: 1.08, color: palette.white, textTransform: "uppercase", textAlign: "center" }}>{beat.heading}</div>
        </div>
      </FlowPop>
      {beat.items.slice(0, 3).map((item, i) => (
        <FlowPop key={i} at={cueSec(item.cue, start, i)} rotate={i % 2 ? 0.8 : -0.8}>
          <Cutout style={{ width: WIDTH, minHeight: 150, padding: "16px 24px", display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                backgroundColor: HIGHLIGHTS[i],
                border: `5px solid ${palette.ink}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: condensed,
                fontWeight: 700,
                fontSize: 42,
                color: palette.ink,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ width: textWidth, fontFamily: condensed, fontWeight: 700, fontSize: fitSize(item.text, textWidth, { max: 48, min: 34, lines: 2 }), lineHeight: 1.12, color: palette.ink, textTransform: "uppercase" }}>{item.text}</div>
          </Cutout>
        </FlowPop>
      ))}
    </Column>
  );
};

export const PortraitBeatView: React.FC<{ beat: Beat; start: number; background: BackgroundName }> = ({ beat, start }) => {
  switch (beat.layout) {
    case "stage":
      return <StageBeat beat={beat} start={start} />;
    case "headline":
      return <HeadlineBeat beat={beat} start={start} />;
    case "counter":
      return <CounterBeat beat={beat} start={start} />;
    case "lineup":
      return <LineupBeat beat={beat} start={start} />;
    case "versus":
      return <VersusBeat beat={beat} start={start} />;
    case "takeaways":
      return <TakeawaysBeat beat={beat} start={start} />;
  }
};
