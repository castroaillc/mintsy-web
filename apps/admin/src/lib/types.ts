/**
 * Shapes shared with backend (books) and studio (studio_jobs).
 * Source: .claude/skills/mintsy-contracts/SKILL.md ("Catalog drafts", "Studio jobs")
 * and backend/src/catalog.ts. Keep in sync with those; do not invent fields.
 */
import type { ObjectId } from "mongodb";

// ─── Catalog (`books`) ────────────────────────────────────────────

/** Missing = "published" (docs that predate drafts). */
export type ContentStatus = "draft" | "published";

export interface TranscriptLine {
  startSec: number;
  text: string;
}

export interface EpisodeDoc {
  number: number;
  title: string;
  summary: string;
  durationSec: number;
  transcript: TranscriptLine[];
  takeaways: string[];
  /** Object path in the media bucket, e.g. "books/psychology-of-money/4.mp4". */
  videoPath?: string;
  thumbnailPath?: string;
  status?: ContentStatus;
  updatedAt?: Date;
}

export interface BookDoc {
  _id: string;
  title: string;
  author: string;
  category: string;
  coverTone: string;
  tint: string;
  description: string;
  /** Rendered cover in the media bucket (studio cover job with upload); apps fall back to the coverTone tile. */
  coverPath?: string;
  /** Position in the catalog listing. */
  order: number;
  episodes: EpisodeDoc[];
  status?: ContentStatus;
  updatedAt?: Date;
}

// ─── Studio jobs (`studio_jobs`) ──────────────────────────────────

export type JobKind = "ingest" | "script" | "render" | "upload" | "cover";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface IngestResult {
  book: { title: string; author: string; category?: string; description?: string };
  chapters: { number: number; title: string }[];
}

/** Contents of script.json / scenes.json. */
export interface ScriptResult {
  script: unknown;
  scenes: unknown;
}

/** Bucket object paths. */
export interface RenderResult {
  durationSec: number;
  videoPath: string;
  thumbnailPath: string;
}

/** render with preview: true (rendered in studio/work only). */
export interface PreviewResult {
  durationSec: number;
  preview: true;
}

export interface CoverResult {
  /** Set when the cover job uploaded it. */
  coverPath?: string;
}

export interface StudioJob {
  _id: ObjectId;
  kind: JobKind;
  /** Book id = catalog _id = studio work/<bookId>. */
  bookId: string;
  /** script, render */
  chapter?: number;
  /** ingest: absolute path to the PDF on this machine */
  pdfPath?: string;
  /** script: rerun from the script step even if files exist */
  regenerate?: boolean;
  /** render: render locally only, no upload and no change to `books` */
  preview?: boolean;
  /** cover: also upload it and set the book's coverPath */
  upload?: boolean;
  /** render: edited script.json to write before voicing (optional) */
  scriptJson?: unknown;
  /** render: edited scenes.json to write before voicing (optional) */
  scenesJson?: unknown;
  status: JobStatus;
  /** Worker appends progress lines (keeps the last 500). */
  log: string[];
  result?: IngestResult | ScriptResult | RenderResult | PreviewResult | CoverResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  workerId?: string;
}

/** What the admin inserts; the worker owns every field after this. */
export type NewStudioJob = Omit<StudioJob, "_id">;

// ─── Serialized forms passed to client components / JSON APIs ─────

export type JobView = Omit<StudioJob, "_id" | "createdAt" | "startedAt" | "finishedAt" | "scriptJson" | "scenesJson"> & {
  id: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  hasEdits: boolean;
};

/** `studio_workers`: one heartbeat doc per running studio worker (written by studio/pipeline/worker.ts every 5s). */
export type StudioWorkerDoc = {
  _id: string;
  pid: number;
  dryRun: boolean;
  startedAt: Date;
  lastSeenAt: Date;
  currentJobId: ObjectId | null;
  /** Job features the worker understands (missing on workers from before this field). */
  capabilities?: string[];
};

export type WorkerView = { id: string; dryRun: boolean; lastSeenAt: string; busy: boolean };
