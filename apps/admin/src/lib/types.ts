/** Studio job shapes, matching studio/pipeline/jobs.ts. Catalog shapes come from @mintsy/shared. */
import type { ObjectId } from "mongodb";

export type { BookDoc, ContentStatus, EpisodeDoc, TranscriptLine } from "@mintsy/shared";

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

/** What the admin inserts; the worker owns every field after this. Admin may still delete a job while it's queued. */
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
