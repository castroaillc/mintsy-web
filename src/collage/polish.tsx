/**
 * The "polish" layer for collage episodes (CollageEpisodeProps.polish): word-synced captions,
 * a wipe between scenes, a slow camera push with drift, and the speech map used to duck the
 * music bed. Everything is driven by frame + the voice step's word timings, so it renders
 * deterministically.
 */
import { noise2D } from "@remotion/noise";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { display } from "../episode/theme";
import { palette } from "./kit";

export type Word = { text: string; startSec: number; endSec: number };

/** Shared motion presets, so every element moves with the same feel. */
export const MOTION = {
  /** Big panels (beats): settles quickly with a hint of overshoot. */
  panel: { damping: 20, stiffness: 120, mass: 0.9 },
  /** Small text: snappy, no overshoot. */
  text: { damping: 200, stiffness: 220, mass: 0.6 },
  /** Emphasis: bouncy. */
  emphasis: { damping: 11, stiffness: 170, mass: 0.7 },
} as const;

// ─── Captions ──────────────────────────────────────────────────────────────

const MAX_WORDS = 7;

/** Groups words into short caption phrases: break on sentence punctuation, pauses, or length. */
export function phrases(words: Word[]): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const [i, w] of words.entries()) {
    cur.push(w);
    const next = words[i + 1];
    const pause = next ? next.startSec - w.endSec > 0.45 : true;
    const punct = /[.!?;:]["')\]]*$/.test(w.text) || (/,$/.test(w.text) && cur.length >= 4);
    if (!next || pause || punct || cur.length >= MAX_WORDS) {
      out.push(cur);
      cur = [];
    }
  }
  return out;
}

/** One phrase at a time along the bottom; the word being spoken is highlighted. */
export const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const groups = phrases(words);
  const index = groups.findIndex((g, i) => {
    const next = groups[i + 1];
    return t >= g[0].startSec - 0.12 && (next ? t < next[0].startSec - 0.12 : t < g[g.length - 1].endSec + 0.8);
  });
  if (index < 0) return null;
  const group = groups[index];
  const startFrame = Math.round((group[0].startSec - 0.12) * fps);
  const enter = spring({ frame: frame - startFrame, fps, config: MOTION.text });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 22, pointerEvents: "none" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "4px 10px",
          maxWidth: 980,
          padding: "10px 18px",
          borderRadius: 14,
          backgroundColor: "rgba(30, 27, 36, 0.78)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          fontFamily: display,
          fontWeight: 700,
          fontSize: 34,
          lineHeight: 1.15,
          letterSpacing: -0.3,
          opacity: interpolate(enter, [0, 1], [0, 1]),
          translate: `0 ${interpolate(enter, [0, 1], [14, 0])}px`,
        }}
      >
        {group.map((w, i) => {
          const active = t >= w.startSec - 0.04 && t < w.endSec + 0.04;
          const said = t >= w.endSec;
          const pop = spring({ frame: frame - Math.round(w.startSec * fps), fps, config: MOTION.emphasis });
          return (
            <span
              key={i}
              style={{
                position: "relative",
                isolation: "isolate",
                color: active ? palette.ink : said ? palette.white : "rgba(251, 247, 238, 0.55)",
                padding: "0 6px",
                margin: "0 -6px",
              }}
            >
              {active ? (
                <span
                  style={{
                    position: "absolute",
                    inset: "2px 0",
                    borderRadius: 8,
                    backgroundColor: palette.yellow,
                    scale: String(interpolate(pop, [0, 1], [0.6, 1])),
                    zIndex: -1,
                  }}
                />
              ) : null}
              <span style={{ position: "relative" }}>{w.text}</span>
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene wipe ────────────────────────────────────────────────────────────

/** A diagonal brand-colored wipe that hides the cut between two scenes. Lasts 18 frames; the cut is at its middle. */
export const WIPE_FRAMES = 18;

export const SceneWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = (delay: number) =>
    interpolate(frame, [delay, delay + WIPE_FRAMES - 4], [-130, 130], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    });
  const band = (color: string, delay: number, width: string) => (
    <div
      style={{
        position: "absolute",
        top: "-20%",
        bottom: "-20%",
        left: "50%",
        width,
        marginLeft: `calc(${width} / -2)`,
        backgroundColor: color,
        rotate: "12deg",
        translate: `${sweep(delay)}% 0`,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {band(palette.yellow, 0, "130%")}
      {band(palette.pink, 2, "120%")}
    </AbsoluteFill>
  );
};

// ─── Camera ────────────────────────────────────────────────────────────────

/** Slow push-in over `durationInFrames` plus a gentle hand-held drift, so nothing sits perfectly still. */
export const Camera: React.FC<{ seed: string; durationInFrames: number; children: React.ReactNode }> = ({
  seed,
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        scale: String(
          interpolate(frame, [0, Math.max(durationInFrames, 1)], [1, 1.04], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        translate: `${noise2D(`${seed}x`, frame / 140, 0) * 5}px ${noise2D(`${seed}y`, 0, frame / 140) * 4}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ─── Music ducking ─────────────────────────────────────────────────────────

/** Frame ranges (relative to the episode body) in which the narrator is speaking. */
export function speechRanges(
  scenes: { words?: Word[]; audioSec: number }[],
  sceneStarts: number[],
  fps: number,
): [number, number][] {
  const ranges: [number, number][] = [];
  scenes.forEach((s, i) => {
    const words = s.words?.length ? s.words : [{ text: "", startSec: 0, endSec: s.audioSec }];
    for (const w of words) {
      const a = sceneStarts[i] + Math.floor(w.startSec * fps);
      const b = sceneStarts[i] + Math.ceil(w.endSec * fps);
      const last = ranges[ranges.length - 1];
      // Short gaps between words don't count as pauses
      if (last && a - last[1] < 0.4 * fps) last[1] = Math.max(last[1], b);
      else ranges.push([a, b]);
    }
  });
  return ranges;
}

/** 0 while speaking, rising to 1 over `ramp` frames into a pause. */
export function pauseLevel(frame: number, ranges: [number, number][], ramp: number) {
  let distance = Infinity;
  for (const [a, b] of ranges) {
    if (frame >= a && frame <= b) return 0;
    distance = Math.min(distance, Math.abs(frame - a), Math.abs(frame - b));
  }
  return Math.min(1, distance / ramp);
}
