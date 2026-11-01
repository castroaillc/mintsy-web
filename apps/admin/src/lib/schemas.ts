import { z } from "zod";

/** Same rule the studio worker enforces (jobs with other ids fail). */
export const BOOK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export const bookIdSchema = z
  .string()
  .trim()
  .max(64, "At most 64 characters")
  .regex(BOOK_ID_RE, "Lowercase letters, digits and hyphens, starting with a letter or digit (e.g. psychology-of-money)");

/**
 * Categories the app knows. Mirrors mobile-app `src/data/types.ts` CATEGORIES (minus "All")
 * and studio `pipeline/steps/ingest.ts` CATEGORIES; change all three together. A book with
 * any other category never matches the app's category chips.
 */
export const CATEGORIES = ["Finance", "Business", "Psychology", "Productivity", "History", "Health"] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(s: string): s is Category {
  return (CATEGORIES as readonly string[]).includes(s);
}

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

export const transcriptLineSchema = z.object({
  startSec: z.number().finite().min(0, "Must be 0 or more"),
  text: z.string().trim().min(1, "Line text is required"),
});

/** Episode text edits; durationSec comes from the stored episode (set by the render). */
export function episodeEditSchema(durationSec: number) {
  return z
    .object({
      title: z.string().trim().min(1, "Required").max(200),
      summary: z.string().trim().min(1, "Required").max(2000),
      takeaways: z.array(z.string().trim().min(1, "Takeaways can't be empty").max(500)).max(20),
      transcript: z.array(transcriptLineSchema).min(1, "At least one transcript line"),
    })
    .superRefine((v, ctx) => {
      v.transcript.forEach((line, i) => {
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
    /** Render locally only (studio/work), no upload and no change to the catalog. */
    preview: z.boolean().optional(),
    scriptJson: scriptJsonSchema.optional(),
    scenesJson: scenesJsonSchema.optional(),
  }),
  z.object({
    kind: z.literal("upload"),
    chapter: z.number().int().min(1),
  }),
]);

export const coverJobSchema = z.object({ upload: z.boolean().optional() });
