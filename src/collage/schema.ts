import { z } from "zod";

// Icon names are plain strings here (a 119-way enum repeated per prop is too large for structured output);
// the pipeline validates them against ICON_NAMES and the renderer falls back to a star.
const IconField = z.string().describe("One of the icon names listed in the instructions");

/**
 * Collage scene contract: Claude composes each scene from fixed layouts, icons and puppet
 * figures; every element carries a cue phrase so it appears when the narrator says it.
 */

const Cue = z
  .string()
  .describe(
    "2–6 words copied exactly from this scene's narration; the element appears when they are spoken",
  );
const Color = z.enum([
  "pink",
  "yellow",
  "mint",
  "teal",
  "gold",
  "plum",
  "slate",
]);
export const Background = z.enum(["mint", "pink", "plum", "cream", "slate"]);
const Label = z
  .string()
  .describe('Short tag under the element, at most 3 words; "" for none');

export const Prop = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("icon"),
    icon: IconField,
    color: Color,
    label: Label,
    cue: Cue,
  }),
  z.object({
    kind: z
      .literal("figure")
      .describe("A simple puppet person; hat and outfit say who they are"),
    hat: z
      .enum(["none", "bowler", "top", "grad", "crown", "cap"])
      .describe(
        "bowler is battered and patched; top = wealthy; grad = scholar; crown = ruler; cap = worker",
      ),
    mood: z.enum(["neutral", "happy", "sad", "surprised"]),
    outfit: Color,
    label: Label,
    cue: Cue,
  }),
]);
export type Prop = z.infer<typeof Prop>;

const Line = z.object({
  text: z.string().describe("At most 6 words, shown in condensed capitals"),
  highlight: z
    .string()
    .describe('Word or phrase from text to color; "" for none'),
  cue: Cue,
});

const Stamp = z.object({
  text: z
    .string()
    .describe('Rubber-stamp text, at most 3 words, e.g. "NEVER WRITTEN"'),
  cue: Cue,
});

const Point = z.object({
  text: z.string().describe("At most 5 words"),
  cue: Cue,
});

export const Beat = z.discriminatedUnion("layout", [
  z.object({
    layout: z
      .literal("stage")
      .describe(
        "A paper card where props pop in one by one: for stories, examples and situations",
      ),
    caption: z
      .string()
      .describe('Tape label across the top, at most 5 words; "" for none'),
    captionCue: z.string().describe('Cue for the caption; "" if no caption'),
    props: z.array(Prop).describe("1 to 5 props; the first is the centrepiece"),
  }),
  z.object({
    layout: z
      .literal("headline")
      .describe(
        "Big kinetic text lines: for a key claim, a list of phrases or contrasts in words",
      ),
    lines: z.array(Line).describe("1 to 3 lines"),
    numbered: z
      .boolean()
      .describe("Numbered dots after each line, for parallel items"),
    stamp: Stamp.nullable().describe(
      "Optional stamp slammed on at the end, e.g. to say something never happened",
    ),
  }),
  z.object({
    layout: z
      .literal("counter")
      .describe(
        "A big icon with a number that counts up: only for a number spoken in this scene",
      ),
    title: z.string().describe("At most 4 words"),
    icon: IconField,
    color: Color,
    value: z.number().describe("The number to count up to"),
    prefix: z.string().describe('e.g. "£" or "$"; "" for none'),
    suffix: z.string().describe('e.g. "%" or " hrs"; "" for none'),
    label: z.string().describe("What the number means, at most 6 words"),
    cue: Cue,
  }),
  z.object({
    layout: z
      .literal("lineup")
      .describe(
        "2 to 4 people or things side by side: for 'everyone gets the same', comparisons across groups",
      ),
    heading: z.string().describe("At most 5 words"),
    members: z.array(Prop).describe("2 to 4 props, each with a label"),
    badge: z
      .string()
      .describe(
        'Badge text shown above every member at the end, e.g. "24"; "" for none',
      ),
    badgeCue: z.string().describe('Cue for the badge; "" if no badge'),
  }),
  z.object({
    layout: z
      .literal("versus")
      .describe(
        "Two sides compared: for contrasts, before/after, right vs wrong",
      ),
    left: z.object({
      label: z.string(),
      prop: Prop,
      points: z.array(Point).describe("1 to 3 points"),
    }),
    right: z.object({
      label: z.string(),
      prop: Prop,
      points: z.array(Point).describe("1 to 3 points"),
    }),
    winner: z
      .enum(["left", "right", "none"])
      .describe("Gets a check; the other side gets an X"),
    verdictCue: z
      .string()
      .describe('Cue for the verdict; "" if winner is none'),
  }),
  z.object({
    layout: z
      .literal("takeaways")
      .describe("Only for the last scene: the three takeaways on paper slips"),
    heading: z.string(),
    items: z.array(Point).describe("Exactly 3"),
  }),
]);
export type Beat = z.infer<typeof Beat>;

export const CollageScene = z.object({
  narration: z
    .string()
    .describe(
      "The narration spoken over this scene, copied verbatim from the script",
    ),
  beats: z
    .array(
      z.object({
        startCue: z
          .string()
          .describe(
            '"" for the first beat; for a second beat, the phrase at which the scene switches to it',
          ),
        background: Background,
        beat: Beat,
      }),
    )
    .describe(
      "1 beat, or 2 when the narration clearly moves to a new picture partway through",
    ),
});
export type CollageScene = z.infer<typeof CollageScene>;

export type TimedCollageScene = CollageScene & {
  audio: string;
  audioSec: number;
  /** Seconds from scene start at which each cue phrase is spoken, keyed by cue text. */
  cueSec: Record<string, number>;
};

export type CollageEpisodeProps = {
  bookTitle: string;
  chapter: number;
  episodeTitle: string;
  scenes: TimedCollageScene[];
};
