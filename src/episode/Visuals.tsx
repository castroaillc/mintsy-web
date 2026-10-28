import { useCurrentFrame, useVideoConfig } from "remotion";

import type { TimedScene, Visual, VisualItem } from "./schema";
import { body, colors, display, enter } from "./theme";

type Of<T extends Visual["type"]> = Extract<Visual, { type: T }>;
type Ctx = { cueSec: TimedScene["cueSec"]; bookTitle: string; author: string };

/** Frame at which an item appears: when its cue is spoken, else staggered after the heading. */
function useItemStart(cueSec: Ctx["cueSec"]) {
  const { fps } = useVideoConfig();
  return (item: VisualItem, index: number) =>
    Math.round((cueSec[item.cue] ?? 0.8 + index * 0.9) * fps);
}

const heading: React.CSSProperties = {
  fontFamily: display,
  fontWeight: 700,
  fontSize: 52,
  lineHeight: 1.1,
  color: colors.foreground,
  margin: 0,
};

const itemText: React.CSSProperties = {
  fontFamily: body,
  fontWeight: 500,
  fontSize: 34,
  lineHeight: 1.3,
  color: colors.foreground,
};

export const VisualView: React.FC<{ visual: Visual } & Ctx> = ({
  visual,
  ...ctx
}) => {
  switch (visual.type) {
    case "title":
      return <TitleVisual visual={visual} {...ctx} />;
    case "statement":
      return <StatementVisual visual={visual} />;
    case "bullets":
      return (
        <ListVisual
          heading={visual.heading}
          items={visual.items}
          marker="dot"
          {...ctx}
        />
      );
    case "steps":
      return (
        <ListVisual
          heading={visual.heading}
          items={visual.items}
          marker="number"
          {...ctx}
        />
      );
    case "takeaways":
      return (
        <ListVisual
          heading={visual.heading}
          items={visual.items}
          marker="card"
          {...ctx}
        />
      );
    case "stat":
      return <StatVisual visual={visual} />;
    case "compare":
      return <CompareVisual visual={visual} {...ctx} />;
    case "quote":
      return <QuoteVisual visual={visual} />;
  }
};

const TitleVisual: React.FC<{ visual: Of<"title"> } & Ctx> = ({
  visual,
  bookTitle,
  author,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          ...enter(frame, 0, fps),
          fontFamily: display,
          fontWeight: 500,
          fontSize: 26,
          letterSpacing: 4,
          color: colors.accent,
        }}
      >
        {visual.kicker.toUpperCase()}
      </div>
      <h1
        style={{
          ...heading,
          ...enter(frame, 0.2 * fps, fps),
          fontSize: 84,
          maxWidth: 1000,
        }}
      >
        {visual.headline}
      </h1>
      <div
        style={{
          ...enter(frame, 0.5 * fps, fps),
          fontFamily: body,
          fontSize: 28,
          color: colors.muted,
        }}
      >
        {bookTitle} · {author}
      </div>
    </div>
  );
};

const StatementVisual: React.FC<{ visual: Of<"statement"> }> = ({ visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Highlight the first occurrence of the emphasis phrase
  const at = visual.emphasis
    ? visual.headline.toLowerCase().indexOf(visual.emphasis.toLowerCase())
    : -1;
  const parts =
    at >= 0
      ? [
          visual.headline.slice(0, at),
          visual.headline.slice(at, at + visual.emphasis.length),
          visual.headline.slice(at + visual.emphasis.length),
        ]
      : [visual.headline, "", ""];
  return (
    <h2
      style={{
        ...heading,
        ...enter(frame, 0.1 * fps, fps),
        fontSize: 72,
        maxWidth: 1050,
      }}
    >
      {parts[0]}
      <span style={{ color: colors.accent }}>{parts[1]}</span>
      {parts[2]}
    </h2>
  );
};

const ListVisual: React.FC<
  {
    heading: string;
    items: VisualItem[];
    marker: "dot" | "number" | "card";
  } & Ctx
> = ({ heading: title, items, marker, cueSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = useItemStart(cueSec);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      <h2 style={{ ...heading, ...enter(frame, 0, fps) }}>{title}</h2>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: marker === "card" ? 18 : 24,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              ...enter(frame, start(item, i), fps),
              display: "flex",
              alignItems: "center",
              gap: 22,
              ...(marker === "card"
                ? {
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 18,
                    padding: "20px 26px",
                  }
                : {}),
            }}
          >
            {marker === "dot" ? (
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: colors.accent,
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.accent,
                  color: colors.accentInk,
                  fontFamily: body,
                  fontWeight: 600,
                  fontSize: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
            )}
            <div style={itemText}>{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatVisual: React.FC<{ visual: Of<"stat"> }> = ({ visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          ...enter(frame, 0.1 * fps, fps),
          fontFamily: display,
          fontWeight: 700,
          fontSize: 200,
          lineHeight: 1,
          color: colors.accent,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {visual.value}
      </div>
      <div
        style={{
          ...itemText,
          ...enter(frame, 0.5 * fps, fps),
          fontSize: 40,
          maxWidth: 900,
        }}
      >
        {visual.label}
      </div>
    </div>
  );
};

const CompareVisual: React.FC<{ visual: Of<"compare"> } & Ctx> = ({
  visual,
  cueSec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = useItemStart(cueSec);
  const column = (
    side: Of<"compare">["left"],
    offset: number,
    highlight: boolean,
  ) => (
    <div
      style={{
        flex: 1,
        backgroundColor: colors.card,
        border: `1px solid ${highlight ? colors.accent : colors.border}`,
        borderRadius: 22,
        padding: "32px 34px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        ...enter(frame, offset * fps, fps),
      }}
    >
      <div
        style={{
          fontFamily: display,
          fontWeight: 700,
          fontSize: 38,
          color: highlight ? colors.accent : colors.foreground,
        }}
      >
        {side.label}
      </div>
      {side.points.map((point, i) => (
        <div
          key={i}
          style={{
            ...itemText,
            fontSize: 30,
            ...enter(frame, start(point, i), fps),
          }}
        >
          {point.text}
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 32 }}>
      {column(visual.left, 0, false)}
      {column(visual.right, 0.25, true)}
    </div>
  );
};

const QuoteVisual: React.FC<{ visual: Of<"quote"> }> = ({ visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        maxWidth: 1000,
      }}
    >
      <div
        style={{
          ...enter(frame, 0, fps),
          fontFamily: display,
          fontSize: 140,
          lineHeight: 0.6,
          color: colors.accent,
        }}
      >
        “
      </div>
      <div
        style={{
          ...enter(frame, 0.15 * fps, fps),
          fontFamily: display,
          fontWeight: 500,
          fontSize: 54,
          lineHeight: 1.2,
          color: colors.foreground,
        }}
      >
        {visual.quote}
      </div>
      <div
        style={{
          ...enter(frame, 0.5 * fps, fps),
          fontFamily: body,
          fontSize: 28,
          color: colors.muted,
        }}
      >
        — {visual.attribution}
      </div>
    </div>
  );
};
