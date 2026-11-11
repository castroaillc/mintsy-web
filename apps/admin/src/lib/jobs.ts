import "server-only";
import type { Filter, ObjectId } from "mongodb";
import { jobsCol, workersCol } from "./mongo";
import type { JobView, NewStudioJob, StudioJob, WorkerView } from "./types";

export function toJobView(j: JobListItem): JobView {
  // dryRun is for the server's plan only.
  const { _id, createdAt, startedAt, finishedAt, dryRun, ...rest } = j;
  void dryRun;
  return {
    ...rest,
    id: _id.toHexString(),
    createdAt: createdAt.toISOString(),
    startedAt: startedAt?.toISOString(),
    finishedAt: finishedAt?.toISOString(),
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

/** Per the contract: admin inserts queued jobs and never updates them. The one exception is cancelQueuedJobs. */
export async function insertJob(job: Omit<NewStudioJob, "status" | "log" | "createdAt">) {
  const col = await jobsCol();
  const doc: NewStudioJob = { ...job, status: "queued", log: [], createdAt: new Date() };
  const res = await col.insertOne(doc as StudioJob);
  return res.insertedId.toHexString();
}

/** Inserts already-built queued jobs in order; a failure part way keeps the earlier ones. Returns their ids. */
export async function insertJobs(docs: NewStudioJob[]) {
  if (docs.length === 0) return [];
  const res = await (await jobsCol()).insertMany(docs as StudioJob[], { ordered: true });
  return docs.map((_, i) => res.insertedIds[i].toHexString());
}

/**
 * Deletes the book's queued jobs. A job the worker has claimed is no longer `queued`, so it's left to
 * finish, and a job deleted here can't be claimed: both go through the same atomic status check.
 * Renders go first: a render whose script job was deleted, if claimed in between, would write the
 * script itself with a paid Claude call. Claiming a script in between is what "the running job finishes" means.
 */
export async function cancelQueuedJobs(bookId: string) {
  const col = await jobsCol();
  const renders = await col.deleteMany({ bookId, status: "queued", kind: "render" });
  const rest = await col.deleteMany({ bookId, status: "queued" });
  return renders.deletedCount + rest.deletedCount;
}

/** Statuses whose whole log lists carry: the UI follows them live. A finished job's log is fetched on demand. */
const LIVE_STATUSES: StudioJob["status"][] = ["queued", "running"];

/**
 * A job as lists see it. Left out, because MongoDB is remote and a poll's time is mostly bytes: the
 * log of finished jobs (`logLines` counts it; `readJobLog` fetches it), a script job's `result.script`
 * and `result.scenes` (read with `latestScript`), and an edited render's `scriptJson` / `scenesJson`.
 */
export type JobListItem = Omit<StudioJob, "log" | "scriptJson" | "scenesJson"> & {
  /** The whole log, only while the job is queued or running. */
  log?: string[];
  logLines: number;
  /** The render carries an edited script.json or scenes.json. */
  hasEdits: boolean;
  /** The log has a dry-run worker's `<step>: (dry run)` line. */
  dryRun: boolean;
};

/** Newest first. Computes the derived fields in MongoDB so the left-out ones never cross the network. */
export async function listJobs(filter: Filter<StudioJob> = {}, limit = 200): Promise<JobListItem[]> {
  const col = await jobsCol();
  const log = { $ifNull: ["$log", []] };
  return col
    .aggregate<JobListItem>([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: limit },
      {
        $set: {
          logLines: { $size: log },
          hasEdits: { $or: [{ $ne: [{ $type: "$scriptJson" }, "missing"] }, { $ne: [{ $type: "$scenesJson" }, "missing"] }] },
          dryRun: { $anyElementTrue: [{ $map: { input: log, as: "line", in: { $regexMatch: { input: "$$line", regex: "dry run\\)$" } } } }] },
          log: { $cond: [{ $in: ["$status", LIVE_STATUSES] }, "$log", "$$REMOVE"] },
        },
      },
      { $unset: ["scriptJson", "scenesJson", "result.script", "result.scenes"] },
    ])
    .toArray();
}

/** One job's whole log, or null when there's no such job. */
export async function readJobLog(id: ObjectId) {
  const job = await (await jobsCol()).findOne({ _id: id }, { projection: { log: 1 } });
  return job ? (job.log ?? []) : null;
}

export async function hasActiveJob(bookId: string, chapter?: number) {
  const col = await jobsCol();
  const q: Filter<StudioJob> = { bookId, status: { $in: ["queued", "running"] } };
  if (chapter !== undefined) q.chapter = chapter;
  return (await col.countDocuments(q, { limit: 1 })) > 0;
}
