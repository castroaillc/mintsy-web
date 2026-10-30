import "server-only";
import type { Filter } from "mongodb";
import { jobsCol } from "./mongo";
import type { JobView, NewStudioJob, StudioJob } from "./types";

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
