import "server-only";
import type { Filter } from "mongodb";
import { jobsCol, workersCol } from "./mongo";
import type { JobView, NewStudioJob, StudioJob, WorkerView } from "./types";

export function toJobView(j: StudioJob): JobView {
  const { _id, createdAt, startedAt, finishedAt, scriptJson, scenesJson, ...rest } = j;
  return {
    ...rest,
    id: _id.toHexString(),
    createdAt: createdAt.toISOString(),
    startedAt: startedAt?.toISOString(),
    finishedAt: finishedAt?.toISOString(),
    hasEdits: scriptJson !== undefined || scenesJson !== undefined,
  };
}

/** A worker that hasn't written its heartbeat for this long is treated as gone (it beats every 5s). */
const WORKER_TIMEOUT_MS = 15_000;

/** Studio workers consuming this database's queue right now, from their `studio_workers` heartbeats. */
export async function listLiveWorkers(): Promise<WorkerView[]> {
  const col = await workersCol();
  const docs = await col.find({ lastSeenAt: { $gte: new Date(Date.now() - WORKER_TIMEOUT_MS) } }).toArray();
  return docs.map((w) => ({ id: w._id, dryRun: w.dryRun, lastSeenAt: w.lastSeenAt.toISOString(), busy: w.currentJobId != null }));
}

/**
 * Refuses a job a running worker would mishandle: e.g. a worker from before preview renders would
 * ignore `preview` and upload. Returns an error message, or null when every live worker supports it.
 */
export async function outdatedWorkerError(capability: string) {
  const col = await workersCol();
  const live = await col.find({ lastSeenAt: { $gte: new Date(Date.now() - WORKER_TIMEOUT_MS) } }).toArray();
  const old = live.filter((w) => !w.capabilities?.includes(capability));
  if (old.length === 0) return null;
  return `The studio worker running now (${old.map((w) => w._id).join(", ")}) predates this feature. Restart it (pnpm dev:studio) and try again.`;
}

/** Per the contract: admin inserts queued jobs and never touches them again. */
export async function insertJob(job: Omit<NewStudioJob, "status" | "log" | "createdAt">) {
  const col = await jobsCol();
  const doc: NewStudioJob = { ...job, status: "queued", log: [], createdAt: new Date() };
  const res = await col.insertOne(doc as StudioJob);
  return res.insertedId.toHexString();
}

export async function listJobs(filter: Filter<StudioJob> = {}, limit = 200) {
  const col = await jobsCol();
  // Large render payloads aren't needed for lists.
  return col
    .find(filter, { projection: { scriptJson: 0, scenesJson: 0 } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();
}

export async function hasActiveJob(bookId: string, chapter?: number) {
  const col = await jobsCol();
  const q: Filter<StudioJob> = { bookId, status: { $in: ["queued", "running"] } };
  if (chapter !== undefined) q.chapter = chapter;
  return (await col.countDocuments(q, { limit: 1 })) > 0;
}
