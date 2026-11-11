/**
 * "Generate whole book": decides which script and preview render jobs a book still needs, and
 * reads progress back from its jobs. Pure, so the API route and the browser share it.
 *
 * The result is local previews only: every render job is `preview: true`, which the worker renders
 * in apps/studio/work with no upload and no write to `books` (apps/studio/pipeline/jobs.ts).
 */
import type { JobKind, JobStatus, NewStudioJob } from "./types";

/**
 * Approximate Claude cost per chapter in USD, from logged usage on past runs at Opus 5.5 pricing.
 * First attempts only: a failed scene validation retries and adds to this.
 */
export const CLAUDE_COST_USD = {
  /** Script + scenes. */
  full: { low: 0.35, high: 0.5 },
  /** Scenes only: script.json is already on disk. */
  scenesOnly: { low: 0.25, high: 0.4 },
};

export type SkipReason = "published" | "draft episode" | "queued or running" | "already done" | "not selected";

export const SKIP_LABEL: Record<SkipReason, string> = {
  published: "already published",
  "draft episode": "already uploaded as a draft episode",
  "queued or running": "a job is queued or running",
  "already done": "script and preview already done",
  "not selected": "not selected",
};

export type ChapterFacts = {
  number: number;
  title: string;
  /** PDF pages in the chapter, when apps/studio/work has the book's book.json. */
  pages: number | null;
  episodeStatus: "draft" | "published" | null;
  active: boolean;
  /** A script job succeeded at some point. */
  scriptJobSucceeded: boolean;
  /** That job ran in dry run, which writes no files, so missing files mean nothing. */
  scriptJobDryRun: boolean;
  /** script.json and scenes.json both exist in apps/studio/work. */
  scriptOnDisk: boolean;
  /** script.json exists in apps/studio/work, so a run that needs Claude only pays for scenes. */
  scriptJsonOnDisk: boolean;
  /** The local render exists and is newer than script.json and scenes.json. */
  renderCurrent: boolean;
};

export type PlannedChapter = {
  number: number;
  title: string;
  pages: number | null;
  script: boolean;
  render: boolean;
  skip: SkipReason | null;
  /**
   * A script job succeeded but its files are gone, so no script job is queued and the render job
   * rebuilds them with Claude (the worker runs any missing earlier step). Counted as paid.
   */
  scriptFilesMissing: boolean;
  /** What this chapter pays Claude for, if anything. */
  paid: "full" | "scenes only" | null;
};

export function planChapter(c: ChapterFacts): PlannedChapter {
  const base = { number: c.number, title: c.title, pages: c.pages, script: false, render: false, scriptFilesMissing: false, paid: null };
  if (c.episodeStatus === "published") return { ...base, skip: "published" };
  if (c.episodeStatus === "draft") return { ...base, skip: "draft episode" };
  if (c.active) return { ...base, skip: "queued or running" };
  if (c.renderCurrent) return { ...base, skip: "already done" };
  const script = !c.scriptJobSucceeded && !c.scriptOnDisk;
  const scriptFilesMissing = c.scriptJobSucceeded && !c.scriptOnDisk && !c.scriptJobDryRun;
  return {
    ...base,
    skip: null,
    script,
    render: true,
    scriptFilesMissing,
    paid: script || scriptFilesMissing ? (c.scriptJsonOnDisk ? "scenes only" : "full") : null,
  };
}

/** Marks chapters outside the selection as skipped. `undefined` selects everything. */
export function applySelection(plan: PlannedChapter[], selected: Iterable<number> | undefined): PlannedChapter[] {
  if (!selected) return plan;
  const keep = new Set(selected);
  return plan.map((c) => (c.skip || keep.has(c.number) ? c : { ...c, script: false, render: false, scriptFilesMissing: false, paid: null, skip: "not selected" }));
}

export type PlanSummary = {
  scripts: number;
  renders: number;
  /** Chapters paying for script + scenes: script jobs, plus render jobs that must rebuild missing script files. */
  fullChapters: number;
  /** Chapters paying for scenes only. */
  scenesOnlyChapters: number;
  /** Approximate total Claude cost in USD. */
  cost: { low: number; high: number };
  skipped: { reason: SkipReason; count: number }[];
};

export function summarizePlan(plan: PlannedChapter[]): PlanSummary {
  const skipped = new Map<SkipReason, number>();
  for (const c of plan) if (c.skip) skipped.set(c.skip, (skipped.get(c.skip) ?? 0) + 1);
  const fullChapters = plan.filter((c) => c.paid === "full").length;
  const scenesOnlyChapters = plan.filter((c) => c.paid === "scenes only").length;
  const total = (bound: "low" | "high") => fullChapters * CLAUDE_COST_USD.full[bound] + scenesOnlyChapters * CLAUDE_COST_USD.scenesOnly[bound];
  return {
    scripts: plan.filter((c) => c.script).length,
    renders: plan.filter((c) => c.render).length,
    fullChapters,
    scenesOnlyChapters,
    cost: { low: total("low"), high: total("high") },
    skipped: [...skipped].map(([reason, count]) => ({ reason, count })),
  };
}

/**
 * The jobs to insert, in the order they must run: per chapter, script then render, chapters ascending.
 * The worker claims with `sort: { createdAt: 1 }` and nothing else, so equal timestamps would leave the
 * order to MongoDB. Each job gets its own millisecond, so a render can't be claimed ahead of its script.
 */
export function buildJobs(bookId: string, plan: PlannedChapter[], startMs: number): NewStudioJob[] {
  const specs = [...plan]
    .sort((a, b) => a.number - b.number)
    .flatMap((c) => [
      ...(c.script ? [{ kind: "script" as const, chapter: c.number }] : []),
      ...(c.render ? [{ kind: "render" as const, chapter: c.number, preview: true }] : []),
    ]);
  return specs.map((spec, i) => ({ ...spec, bookId, status: "queued" as const, log: [], createdAt: new Date(startMs + i) }));
}

// ─── Reading the result back ──────────────────────────────────────

type JobLike = { kind: JobKind; status: JobStatus; error?: string };

const isActive = (j: { status: JobStatus }) => j.status === "queued" || j.status === "running";

/**
 * What went wrong for a chapter, given its jobs newest first. A failed script job doesn't end the
 * chapter: the queued render job runs any missing step itself, so it tries the script again (paid).
 * The script's error is the cause, so it comes first.
 */
export function describeChapterFailure(jobs: JobLike[]): string | null {
  const latest = jobs[0];
  if (!latest) return null;
  const script = jobs.find((j) => j.kind === "script");
  const render = jobs.find((j) => j.kind === "render");
  const scriptFailed = script?.status === "failed";
  const renderIsNewer = !!render && jobs.indexOf(render) < jobs.indexOf(script as JobLike);
  if (scriptFailed && renderIsNewer) {
    const cause = `Script failed: ${script.error ?? "no error message"}.`;
    if (isActive(render)) return `${cause} Its render job is next and tries the script again, which is another paid call.`;
    if (render.status === "succeeded") return `${cause} Its render job then wrote the script itself and finished, so the preview is ready. To review that script, click Generate script on the chapter page: it reuses the files, with no Claude call.`;
    if (render.error === script.error) return `${cause} Its render job tried the script again and failed the same way.`;
    return `${cause} Its render job tried the script again and also failed: ${render.error ?? "no error message"}.`;
  }
  return latest.status === "failed" ? `${latest.kind} failed: ${latest.error ?? "no error message"}` : null;
}

type RunJob = JobLike & { id: string; chapter?: number; createdAt: string; finishedAt?: string };

export type RunProgress<T> = {
  total: number;
  succeeded: number;
  failed: number;
  queued: number;
  running: T | null;
  /** Newest first, grouped by chapter. */
  byChapter: Map<number, T[]>;
};

/**
 * The latest run of a book's script and render jobs. Jobs carry no batch id (the contract has none), so a
 * run is the latest group of jobs whose time in the queue overlaps: it starts when one is created with
 * none unfinished, which also picks up per-chapter jobs queued during a whole-book run.
 */
export function latestRun<T extends RunJob>(jobs: T[]): RunProgress<T> {
  const ordered = jobs
    .filter((j) => (j.kind === "script" || j.kind === "render") && j.chapter !== undefined)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let run: T[] = [];
  let openUntil = -Infinity;
  for (const j of ordered) {
    if (Date.parse(j.createdAt) > openUntil) {
      run = [];
      openUntil = -Infinity;
    }
    run.push(j);
    openUntil = Math.max(openUntil, j.finishedAt ? Date.parse(j.finishedAt) : Infinity);
  }
  const byChapter = new Map<number, T[]>();
  for (const j of [...run].reverse()) byChapter.set(j.chapter as number, [...(byChapter.get(j.chapter as number) ?? []), j]);
  return {
    total: run.length,
    succeeded: run.filter((j) => j.status === "succeeded").length,
    failed: run.filter((j) => j.status === "failed").length,
    queued: run.filter((j) => j.status === "queued").length,
    running: run.find((j) => j.status === "running") ?? null,
    byChapter,
  };
}
