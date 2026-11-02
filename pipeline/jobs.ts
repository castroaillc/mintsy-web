/**
 * Studio job kinds run by the worker (see the "Studio jobs" contract in .claude/skills/mintsy-contracts).
 * Each runner does the pipeline work, writes the draft book/episode into MongoDB `books`, and returns the job result.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Db, ObjectId } from "mongodb";

import { runEpisode, type StepName } from "./episode";
import { bookDir, episodeDir, files } from "./paths";
import { renderCover, uploadCover } from "./steps/cover";
import { type BookInfo, ingest } from "./steps/ingest";
import { type CatalogEpisode, episodeFields, mediaPrefix, uploadMedia } from "./steps/publish";
import type { Script } from "./steps/script";
import { normalize, readJson, writeJson } from "./util";

export type JobKind = "ingest" | "script" | "render" | "upload" | "cover";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export interface StudioJob {
  _id: ObjectId;
  kind: JobKind;
  bookId: string;
  chapter?: number;
  pdfPath?: string;
  regenerate?: boolean;
  /** render: render locally only (work/<book>/ep-NN), no upload and no change to `books`. */
  preview?: boolean;
  /** cover: also upload it and set the book's coverPath (live at once if the book is published). */
  upload?: boolean;
  scriptJson?: unknown;
  scenesJson?: unknown;
  status: JobStatus;
  log: string[];
  result?: JobResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  workerId?: string;
}
export interface IngestResult {
  book: { title: string; author: string; category?: string; description?: string };
  chapters: { number: number; title: string }[];
}
export interface ScriptResult {
  script: unknown;
  scenes: unknown;
}
export interface RenderResult {
  durationSec: number;
  videoPath: string;
  thumbnailPath: string;
  /** Bucket path of the HLS master playlist. */
  hlsPath?: string;
}
/** render with preview: true. */
export interface PreviewResult {
  durationSec: number;
  preview: true;
}
export interface CoverResult {
  /** Set when the job uploaded the cover. */
  coverPath?: string;
}
export type JobResult = IngestResult | ScriptResult | RenderResult | PreviewResult | CoverResult;

type ContentStatus = "draft" | "published";
type EpisodeDoc = CatalogEpisode & { status?: ContentStatus; updatedAt?: Date };
interface BookDoc {
  _id: string;
  title: string;
  author: string;
  category: string;
  coverTone: string;
  tint: string;
  description: string;
  order: number;
  episodes: EpisodeDoc[];
  /** Rendered cover in the media bucket (cover job with upload). */
  coverPath?: string;
  status?: ContentStatus;
  updatedAt?: Date;
}

const DEFAULT_COVER_TONE = "#E7DFCF";
const DEFAULT_TINT = "#3B3426";

export const DRY_RUN = process.env.STUDIO_WORKER_DRY_RUN === "1";

export async function runJob(db: Db, job: StudioJob): Promise<JobResult> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(job.bookId ?? "")) throw new Error(`Invalid bookId "${job.bookId}" (use lowercase letters, digits and dashes)`);
  if (job.kind === "ingest") return DRY_RUN ? dryIngest(db, job) : ingestJob(db, job);
  if (job.kind === "cover") return DRY_RUN ? dryCover(db, job) : coverJob(db, job);
  const chapter = requireChapter(job);
  if (job.kind === "script") return DRY_RUN ? dryScript(job, chapter) : scriptJob(job, chapter);
  if (job.kind === "render") return DRY_RUN ? dryRender(db, job, chapter) : renderJob(db, job, chapter);
  if (job.kind === "upload") return DRY_RUN ? dryUpload(db, job, chapter) : uploadJob(db, job, chapter);
  throw new Error(`Unknown job kind "${String(job.kind)}"`);
}

function requireChapter(job: StudioJob) {
  const chapter = job.chapter;
  if (typeof chapter !== "number" || !Number.isInteger(chapter) || chapter < 1) {
    throw new Error(`${job.kind} job needs a positive integer chapter`);
  }
  return chapter;
}

// ─── books collection ──────────────────────────────────────────────────────

const booksOf = (db: Db) => db.collection<BookDoc>("books");

/** Inserts the book as a draft with no episodes, after the current last one. Never touches an existing doc. */
async function insertDraftBook(db: Db, bookId: string, info: Omit<BookInfo, "chapters"> & Partial<Pick<BookInfo, "chapters">>) {
  const books = booksOf(db);
  const last = await books.find({}, { projection: { order: 1 } }).sort({ order: -1 }).limit(1).next();
  const now = new Date();
  const res = await books.updateOne(
    { _id: bookId },
    {
      $setOnInsert: {
        title: info.title,
        author: info.author,
        category: info.category,
        description: info.description,
        coverTone: info.coverTone || DEFAULT_COVER_TONE,
        tint: info.tint || DEFAULT_TINT,
        order: (last?.order ?? -1) + 1,
        episodes: [],
        status: "draft",
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  console.log(res.upsertedCount ? `  added draft book "${bookId}" to books` : `  book "${bookId}" already in books, left as is`);
}

/** Inserts or replaces episode `number` in the book, always as a draft (a re-render unpublishes it). */
async function upsertDraftEpisode(db: Db, bookId: string, episode: CatalogEpisode & Required<Pick<CatalogEpisode, "videoPath" | "thumbnailPath" | "hlsPath">>) {
  const books = booksOf(db);
  const now = new Date();
  const doc: EpisodeDoc = { ...episode, status: "draft", updatedAt: now };
  const set = Object.fromEntries(Object.entries(doc).map(([k, v]) => [`episodes.$.${k}`, v]));
  const updated = await books.updateOne({ _id: bookId, "episodes.number": episode.number }, { $set: { ...set, updatedAt: now } });
  if (updated.matchedCount === 0) {
    const pushed = await books.updateOne(
      { _id: bookId, "episodes.number": { $ne: episode.number } },
      { $push: { episodes: { $each: [doc], $sort: { number: 1 } } }, $set: { updatedAt: now } },
    );
    if (pushed.matchedCount === 0) throw new Error(`Book "${bookId}" is not in books; run an ingest job first`);
  }
  console.log(`  saved draft episode ${episode.number} of "${bookId}" to books`);
}

/** Makes sure the book is in `books` (e.g. ingested with the CLI before the worker existed). */
async function ensureBook(db: Db, bookId: string) {
  if (await booksOf(db).findOne({ _id: bookId }, { projection: { _id: 1 } })) return;
  const file = path.join(bookDir(bookId), files.book);
  if (!existsSync(file)) throw new Error(`Book "${bookId}" has no ${files.book}; run an ingest job first`);
  await insertDraftBook(db, bookId, await readJson<BookInfo>(file));
}

const ingestResult = (info: BookInfo): IngestResult => ({
  book: { title: info.title, author: info.author, category: info.category, description: info.description },
  chapters: info.chapters.map((c) => ({ number: c.number, title: c.title })),
});

// ─── real jobs ─────────────────────────────────────────────────────────────

async function ingestJob(db: Db, job: StudioJob): Promise<IngestResult> {
  if (!job.pdfPath) throw new Error("ingest job needs pdfPath");
  if (!existsSync(job.pdfPath) && !existsSync(path.join(bookDir(job.bookId), files.book))) {
    throw new Error(`PDF not found: ${job.pdfPath}`);
  }
  console.log("ingest:");
  const info = await ingest(job.pdfPath, job.bookId);
  console.log(`  ${info.title} by ${info.author}: ${info.chapters.length} chapters`);
  await insertDraftBook(db, job.bookId, info);
  // A local cover to look at straight away; publishing it is a separate cover job
  try {
    console.log("cover:");
    await renderCover(job.bookId, { title: info.title, author: info.author, category: info.category, coverTone: info.coverTone });
  } catch (err) {
    console.log(`  cover not rendered: ${err instanceof Error ? err.message : String(err)}`);
  }
  return ingestResult(info);
}

async function scriptJob(job: StudioJob, chapter: number): Promise<ScriptResult> {
  const dir = await runEpisode(job.bookId, chapter, job.regenerate ? "script" : undefined, "scenes");
  return {
    script: await readJson(path.join(dir, files.script)),
    scenes: await readJson(path.join(dir, files.scenes)),
  };
}

async function renderJob(db: Db, job: StudioJob, chapter: number): Promise<RenderResult | PreviewResult> {
  if (!job.preview) await ensureBook(db, job.bookId);
  const dir = episodeDir(job.bookId, chapter);
  await mkdir(dir, { recursive: true });

  // Voice is cached per scene (by text + voice), so rerunning it only narrates changed scenes.
  // A render job always re-renders, so the video matches the current script and scenes.
  let from: StepName = "voice";
  if (job.scriptJson !== undefined) await writeJson(path.join(dir, files.script), job.scriptJson);
  if (job.scenesJson !== undefined) await writeJson(path.join(dir, files.scenes), job.scenesJson);
  if (job.scriptJson !== undefined && job.scenesJson === undefined && (await narrationChanged(dir))) {
    // Edited narration without matching scenes: redo the scene split (one Claude call) so voice reads the new text
    console.log("script narration changed and no scenes were given: regenerating scenes");
    from = "scenes";
  }
  if (job.scriptJson !== undefined || job.scenesJson !== undefined) console.log("wrote edited script/scenes");

  await runEpisode(job.bookId, chapter, from, "render");
  if (job.preview) {
    const { durationSec } = await episodeFields(chapter, dir);
    console.log("preview: rendered locally; nothing uploaded");
    return { durationSec, preview: true };
  }
  console.log("upload:");
  const fields = await episodeFields(chapter, dir);
  const media = await uploadMedia(job.bookId, chapter, dir);
  await upsertDraftEpisode(db, job.bookId, { ...fields, ...media });
  return { durationSec: fields.durationSec, ...media };
}

/** Uploads the episode as it was last rendered (e.g. by a preview) and saves it as a draft. */
async function uploadJob(db: Db, job: StudioJob, chapter: number): Promise<RenderResult> {
  await ensureBook(db, job.bookId);
  const dir = episodeDir(job.bookId, chapter);
  for (const f of [files.video, files.thumbnail, files.script, files.voice]) {
    if (!existsSync(path.join(dir, f))) throw new Error(`No ${f} for chapter ${chapter}: render a preview first`);
  }
  console.log("upload:");
  const fields = await episodeFields(chapter, dir);
  const media = await uploadMedia(job.bookId, chapter, dir);
  await upsertDraftEpisode(db, job.bookId, { ...fields, ...media });
  return { durationSec: fields.durationSec, ...media };
}

/** Renders the book's cover from its current metadata in `books`; with upload, publishes it as coverPath. */
async function coverJob(db: Db, job: StudioJob): Promise<CoverResult> {
  await ensureBook(db, job.bookId);
  const book = await booksOf(db).findOne({ _id: job.bookId }, { projection: { title: 1, author: 1, category: 1, coverTone: 1 } });
  if (!book) throw new Error(`Book "${job.bookId}" is not in books`);
  console.log("cover:");
  await renderCover(job.bookId, { title: book.title, author: book.author, category: book.category, coverTone: book.coverTone });
  if (!job.upload) return {};
  console.log("upload:");
  const coverPath = await uploadCover(job.bookId);
  await booksOf(db).updateOne({ _id: job.bookId }, { $set: { coverPath, updatedAt: new Date() } });
  console.log(`  set coverPath on "${job.bookId}"`);
  return { coverPath };
}

async function narrationChanged(dir: string) {
  const scenesPath = path.join(dir, files.scenes);
  if (!existsSync(scenesPath)) return true;
  const script = await readJson<Script>(path.join(dir, files.script));
  const scenes = await readJson<{ narration: string }[]>(scenesPath);
  return normalize(script.narration.join(" ")) !== normalize(scenes.map((s) => s.narration).join(" "));
}

// ─── dry run: plausible fakes, no Claude / Kokoro / Remotion / ffmpeg / bucket, no files in work/ ───

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fakeSteps(steps: string[]) {
  for (const step of steps) {
    console.log(`${step}: (dry run)`);
    await pause(400);
  }
}

const titleCase = (id: string) => id.replace(/(^|-)(\w)/g, (_, dash: string, c: string) => (dash ? " " : "") + c.toUpperCase());

function fakeBook(bookId: string): BookInfo {
  const chapterTitles = ["The Starting Point", "Small Habits, Big Results", "Thinking in Decades", "The Cost of Waiting", "Putting It to Work"];
  return {
    title: titleCase(bookId),
    author: "Dry Run Author",
    category: "Productivity",
    description: `A dry-run stand-in for ${titleCase(bookId)}: what the book argues and why it matters, in two sentences.`,
    coverTone: DEFAULT_COVER_TONE,
    tint: DEFAULT_TINT,
    chapters: chapterTitles.map((title, i) => ({ number: i + 1, title, startPage: 4 + i * 10, endPage: 13 + i * 10 })),
  };
}

function fakeScript(bookId: string, chapter: number): Script {
  const title = fakeBook(bookId).chapters[chapter - 1]?.title ?? `Chapter ${chapter}`;
  return {
    title,
    summary: `Why ${title.toLowerCase()} matters more than it looks, and one way to use it this week.`,
    takeaways: ["Start smaller than feels useful.", "Consistency beats intensity over a year.", "Write the plan down before you begin."],
    narration: [
      "Picture two people with the same job, the same income and the same free evening.",
      "One drifts. The other picks one small thing and does it every day. A year later, they are not in the same place.",
      "Here is how to be the second person, starting tonight.",
    ],
  };
}

function fakeScenes(script: Script) {
  return script.narration.map((narration, i) => ({
    narration,
    beats: [
      {
        startCue: "",
        background: i % 2 ? "stripes" : "cream",
        beat: { layout: "headline", text: script.takeaways[i] ?? script.title, cue: narration.split(" ").slice(0, 3).join(" ") },
      },
    ],
  }));
}

async function dryIngest(db: Db, job: StudioJob): Promise<IngestResult> {
  if (!job.pdfPath) throw new Error("ingest job needs pdfPath");
  await fakeSteps(["extract pages", "book info + chapters"]);
  const info = fakeBook(job.bookId);
  console.log(`  ${info.title} by ${info.author}: ${info.chapters.length} chapters`);
  await insertDraftBook(db, job.bookId, info);
  return ingestResult(info);
}

async function dryScript(job: StudioJob, chapter: number): Promise<ScriptResult> {
  await fakeSteps(["chapter", "script", "scenes"]);
  const script = fakeScript(job.bookId, chapter);
  return { script, scenes: fakeScenes(script) };
}

async function dryUpload(db: Db, job: StudioJob, chapter: number): Promise<RenderResult> {
  return (await dryRender(db, { ...job, preview: false }, chapter, [])) as RenderResult;
}

async function dryCover(db: Db, job: StudioJob): Promise<CoverResult> {
  await fakeSteps(job.upload ? ["cover", "upload"] : ["cover"]);
  if (!job.upload) return {};
  const coverPath = `books/${job.bookId}/cover-dryrun.jpg`;
  await booksOf(db).updateOne({ _id: job.bookId }, { $set: { coverPath, updatedAt: new Date() } });
  return { coverPath };
}

async function dryRender(
  db: Db,
  job: StudioJob,
  chapter: number,
  steps = ["voice", "render 0%", "render 50%", "render 100%"],
): Promise<RenderResult | PreviewResult> {
  if (!(await booksOf(db).findOne({ _id: job.bookId }, { projection: { _id: 1 } }))) {
    await insertDraftBook(db, job.bookId, fakeBook(job.bookId));
  }
  if (job.scriptJson !== undefined || job.scenesJson !== undefined) console.log("wrote edited script/scenes (dry run: not saved)");
  await fakeSteps(job.preview ? steps : [...steps, "upload", "hls"]);
  const edited = job.scriptJson as Partial<Script> | undefined;
  const script = { ...fakeScript(job.bookId, chapter), ...(edited && typeof edited === "object" ? edited : {}) };
  const hash = createHash("sha256").update(`${job._id.toHexString()}|${JSON.stringify(script)}`).digest("hex").slice(0, 8);
  const prefix = mediaPrefix(job.bookId, chapter, hash);
  const narration = Array.isArray(script.narration) ? script.narration : [];
  const transcript = narration.flatMap((p) => p.match(/[^.!?]+[.!?]+/g) ?? [p]).map((text, i) => ({ startSec: 4 + i * 6, text: text.trim() }));
  const durationSec = 4 + transcript.length * 6 + 2;
  if (job.preview) return { durationSec, preview: true };
  const episode = {
    number: chapter,
    title: String(script.title),
    summary: String(script.summary),
    takeaways: Array.isArray(script.takeaways) ? script.takeaways.map(String) : [],
    transcript,
    durationSec,
    videoPath: `${prefix}.mp4`,
    thumbnailPath: `${prefix}.jpg`,
    hlsPath: `${prefix}/master.m3u8`,
  };
  await upsertDraftEpisode(db, job.bookId, episode);
  return { durationSec, videoPath: episode.videoPath, thumbnailPath: episode.thumbnailPath, hlsPath: episode.hlsPath };
}
