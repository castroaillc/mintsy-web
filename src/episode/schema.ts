import { z } from "zod";

/**
 * Shared contract between the pipeline (Claude writes it, ElevenLabs times it) and the
 * Remotion composition (renders it). Visuals are a fixed set of templates so every episode
 * stays on-brand and renders deterministically.
 */

/** A line of on-screen text that appears when the narrator says `cue` (exact words from the scene's narration). */
const Item = z.object({
  text: z.string().describe("On-screen text, at most ~8 words"),
  cue: z
    .string()
    .describe(
      "Exact words from this scene's narration; the item appears when they are spoken",
    ),
});

export const Visual = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("title"),
    kicker: z
      .string()
      .describe('Small label above the headline, e.g. "CHAPTER 4"'),
    headline: z.string(),
  }),
  z.object({
    type: z.literal("statement"),
    headline: z.string().describe("One idea, at most ~12 words"),
    emphasis: z
      .string()
      .describe(
        "A word or short phrase from the headline to highlight in the accent color",
      ),
  }),
  z.object({
    type: z.literal("bullets"),
    heading: z.string(),
    items: z.array(Item).describe("2 to 4 items"),
  }),
  z.object({
    type: z.literal("stat"),
    value: z
      .string()
      .describe('The number as displayed, e.g. "95%" or "$2.7B"'),
    label: z.string().describe("What the number means, at most ~10 words"),
  }),
  z.object({
    type: z.literal("compare"),
    left: z.object({
      label: z.string(),
      points: z.array(Item).describe("1 to 3 items"),
    }),
    right: z.object({
      label: z.string(),
      points: z.array(Item).describe("1 to 3 items"),
    }),
  }),
  z.object({
    type: z.literal("steps"),
    heading: z.string(),
    items: z.array(Item).describe("2 to 5 items, in order"),
  }),
  z.object({
    type: z.literal("quote"),
    quote: z.string().describe("A short line, at most ~20 words"),
    attribution: z.string(),
  }),
  z.object({
    type: z.literal("takeaways"),
    heading: z.string(),
    items: z.array(Item).describe("Exactly 3 items"),
  }),
]);
export type Visual = z.infer<typeof Visual>;
export type VisualItem = z.infer<typeof Item>;

export const Scene = z.object({
  narration: z
    .string()
    .describe(
      "The narration spoken over this scene, copied verbatim from the script",
    ),
  visual: Visual,
});
export type Scene = z.infer<typeof Scene>;

/** Props for the Episode composition, written by the voice step. */
export type TimedScene = Scene & {
  /** Audio file relative to the episode folder (served as the bundle's public dir). */
  audio: string;
  audioSec: number;
  /** Seconds from scene start at which each item's cue is spoken, keyed by cue text. */
  cueSec: Record<string, number>;
};

export type EpisodeProps = {
  bookTitle: string;
  chapter: number;
  episodeTitle: string;
  author: string;
  /** Book tint from the catalog; colors the backdrop. */
  tint: string;
  scenes: TimedScene[];
};
