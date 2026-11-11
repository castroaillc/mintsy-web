import { CATEGORIES } from "@mintsy/shared";
import { z } from "zod";

/** Same rule the studio worker enforces (jobs with other ids fail). */
export const BOOK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export const bookIdSchema = z
  .string()
  .trim()
  .max(64, "At most 64 characters")
  .regex(BOOK_ID_RE, "Lowercase letters, digits and hyphens, starting with a letter or digit (e.g. psychology-of-money)");

export { CATEGORIES, isCategory, type Category } from "@mintsy/shared";

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour");

export const bookMetaSchema = z.object({
  title: z.string().trim().min(1, "Required").max(200),
  author: z.string().trim().min(1, "Required").max(200),
  category: z.enum(CATEGORIES, `Pick one of: ${CATEGORIES.join(", ")}`),
  description: z.string().trim().max(2000),
  tint: hex,
  coverTone: hex,
  order: z.coerce.number().int("Whole number").min(0, "0 or more").max(100000),
});
export type BookMeta = z.infer<typeof bookMetaSchema>;
/** Form state: the stored category may be outside CATEGORIES (or empty) until staff pick one. */
export type BookMetaDraft = Omit<BookMeta, "category"> & { category: string };

export const statusSchema = z.object({ status: z.enum(["draft", "published"]) });

/** Publish several episodes at once. Bulk unpublish isn't offered: only the highest published one can go. */
export const bulkPublishSchema = z.object({
  numbers: z.array(z.number().int("Whole numbers").min(1, "Episode numbers start at 1")).min(1, "Select at least one episode").max(1000),
  status: z.literal("published"),
});

export const transcriptLineSchema = z.object({
  startSec: z.number().finite().min(0, "Must be 0 or more"),
  text: z.string().trim().min(1, "Line text is required"),
});

type Line = { startSec: number; text: string };

/** The same lines, ignoring whitespace the schema trims anyway. */
export function sameTranscript(a: Line[], b: Line[]) {
  return a.length === b.length && a.every((line, i) => line.startSec === b[i].startSec && line.text.trim() === b[i].text.trim());
}

/** The stored `updatedAt` the episode form loaded with (null if the episode has none). Sent on every save. */
export const episodeBaseSchema = z.object({ baseUpdatedAt: z.string().nullable() });

export type EpisodeEditContext = {
  /** Episode length, from the render. */
  durationSec: number;
  /** The transcript in `books`. Sending it back unchanged isn't a transcript edit, so its timing isn't rechecked. */
  storedTranscript: Line[];
  /** Lines per voice on an episode with voices, whose line count can't change. Null without voices. */
  voiceLineCount: number | null;
};

/**
 * Episode text edits. Timing rules apply only to a transcript that changed: the form always sends the
 * transcript, and an older episode with fractional times must still save its title.
 * The API exposes startSec as Int!, non-null all the way up, so one fractional time on a public episode
 * loses the whole `books` response for the app, and one in a voice fails that episode's `episodeVoices`.
 */
export function episodeEditSchema({ durationSec, storedTranscript, voiceLineCount }: EpisodeEditContext) {
  return z
    .object({
      title: z.string().trim().min(1, "Required").max(200),
      summary: z.string().trim().min(1, "Required").max(2000),
      takeaways: z.array(z.string().trim().min(1, "Takeaways can't be empty").max(500)).max(20),
      transcript: z.array(transcriptLineSchema).min(1, "At least one transcript line"),
    })
    .superRefine((v, ctx) => {
      if (sameTranscript(v.transcript, storedTranscript)) return;
      if (voiceLineCount !== null && v.transcript.length !== voiceLineCount) {
        ctx.addIssue({
          code: "custom",
          path: ["transcript"],
          message: `This episode has voices with ${voiceLineCount} transcript lines each, and the app converts positions between voices by matching lines, so the count can't change (this edit has ${v.transcript.length}). Edit the existing lines instead.`,
        });
      }
      v.transcript.forEach((line, i) => {
        if (!Number.isInteger(line.startSec)) {
          ctx.addIssue({ code: "custom", path: ["transcript", i, "startSec"], message: "Use whole seconds" });
        }
        if (i > 0 && line.startSec <= v.transcript[i - 1].startSec) {
          ctx.addIssue({
            code: "custom",
            path: ["transcript", i, "startSec"],
            message: `Must be after line ${i} (${v.transcript[i - 1].startSec}s)`,
          });
        }
        if (durationSec > 0 && line.startSec >= durationSec) {
          ctx.addIssue({
            code: "custom",
            path: ["transcript", i, "startSec"],
            message: `Must be under the episode duration (${durationSec}s)`,
          });
        }
      });
    });
}

/**
 * script.json as the studio pipeline writes it today. Known fields are type-checked;
 * anything else is kept as-is (the studio owns the format).
 */
export const scriptJsonSchema = z.looseObject({
  title: z.string().min(1, "title is required"),
  summary: z.string().optional(),
  takeaways: z.array(z.string()).optional(),
  narration: z.array(z.string()).optional(),
});

/** scenes.json: an array of scene objects (format owned by studio). */
export const scenesJsonSchema = z.array(z.looseObject({}), "scenes.json must be an array of scene objects");

export const createJobSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("script"),
    chapter: z.number().int().min(1),
    regenerate: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("render"),
    chapter: z.number().int().min(1),
    /** Render locally only (apps/studio/work), no upload and no change to the catalog. */
    preview: z.boolean().optional(),
    scriptJson: scriptJsonSchema.optional(),
    scenesJson: scenesJsonSchema.optional(),
  }),
  z.object({
    kind: z.literal("upload"),
    chapter: z.number().int().min(1),
  }),
  // Strict: a remaster job with scriptJson, scenesJson or preview fails in the worker.
  z.strictObject({
    kind: z.literal("remaster"),
    chapter: z.number().int().min(1),
    /** Only after a refusal: replaces transcript text that differs in `books`. */
    overwriteTranscript: z.boolean().optional(),
  }),
  z
    .strictObject({
      kind: z.literal("clip"),
      chapter: z.number().int().min(1),
      /** Voice id such as "af_heart"; studio defaults to the episode's default voice. */
      voice: z.string().regex(/^[a-z]{2}_[a-z0-9]+$/, "Use a voice id such as af_heart").optional(),
      startScene: z.number().int().min(1).optional(),
      endScene: z.number().int().min(1).optional(),
    })
    .refine((v) => v.endScene === undefined || v.endScene >= (v.startScene ?? 1), { path: ["endScene"], message: "Must not be before the start scene" }),
]);

/** POST /api/books/[id]/jobs/all. Without `chapters`, every chapter that needs anything. */
export const generateAllSchema = z.strictObject({
  chapters: z.array(z.number().int().min(1)).max(1000).optional(),
});

export const coverJobSchema = z.object({ upload: z.boolean().optional() });
