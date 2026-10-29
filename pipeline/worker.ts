/**
 * `pnpm worker`: runs studio jobs that the admin dashboard queues in MongoDB `studio_jobs`, one at a time.
 * Ctrl-C once to stop after the current job; twice to abort it (it is marked failed).
 */
import os from "node:os";
import { format } from "node:util";
import { type Collection, MongoClient } from "mongodb";

import "./paths"; // loads .env
import { DRY_RUN, runJob, type StudioJob } from "./jobs";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "mintsy";
const WORKER_ID = process.env.STUDIO_WORKER_ID || os.hostname();
const POLL_MS = Number(process.env.STUDIO_WORKER_POLL_MS) || 2000;
const LOG_LINES = 500;
const FLUSH_MS = 1000;

let stopping = false;
let wake: (() => void) | undefined;

/** Captures console output into the job's `log` (last 500 lines), flushed about once a second. */
function captureLog(jobs: Collection<StudioJob>, job: StudioJob) {
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  let pending: string[] = [];
  let writing = Promise.resolve();

  const flush = () => {
    if (pending.length === 0) return writing;
    const lines = pending;
    pending = [];
    writing = writing
      .then(() => jobs.updateOne({ _id: job._id }, { $push: { log: { $each: lines, $slice: -LOG_LINES } } }))
      .then(
        () => undefined,
        (err: unknown) => original.error("could not write job log:", err),
      );
    return writing;
  };
  const capture =
    (write: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      write(...args);
      for (const line of format(...args).split("\n")) if (line.trim()) pending.push(line.trimEnd());
    };
  console.log = capture(original.log);
  console.info = capture(original.info);
  console.warn = capture(original.warn);
  console.error = capture(original.error);
  const timer = setInterval(flush, FLUSH_MS);

  return async () => {
    clearInterval(timer);
    Object.assign(console, original);
    await flush();
  };
}

async function claim(jobs: Collection<StudioJob>) {
  return jobs.findOneAndUpdate(
    { status: "queued" },
    { $set: { status: "running", startedAt: new Date(), workerId: WORKER_ID } },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  );
}

async function work(jobs: Collection<StudioJob>, job: StudioJob) {
  const stopCapture = captureLog(jobs, job);
  const label = `${job.kind} ${job.bookId}${job.chapter ? ` ch ${job.chapter}` : ""}`;
  console.log(`▶ ${label} (job ${job._id.toHexString()} on ${WORKER_ID}${DRY_RUN ? ", dry run" : ""})`);
  try {
    const result = await runJob(jobs.db, job);
    console.log(`✓ ${label} succeeded`);
    await stopCapture();
    await jobs.updateOne({ _id: job._id, status: "running" }, { $set: { status: "succeeded", result, finishedAt: new Date() } });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${label} failed: ${error}`);
    await stopCapture();
    await jobs.updateOne({ _id: job._id, status: "running" }, { $set: { status: "failed", error, finishedAt: new Date() } });
  }
}

async function idle(ms: number) {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  wake = undefined;
}

async function main() {
  if (!MONGODB_URI) throw new Error("Set MONGODB_URI in studio/.env (see .env.example)");
  const client = await new MongoClient(MONGODB_URI).connect();
  const jobs = client.db(MONGODB_DB).collection<StudioJob>("studio_jobs");
  await jobs.createIndex({ status: 1, createdAt: 1 });

  // Jobs this machine left running (crash, killed terminal) can't be resumed
  const stale = await jobs.updateMany(
    { status: "running", workerId: WORKER_ID },
    {
      $set: { status: "failed", error: "Worker restarted while this job was running", finishedAt: new Date() },
      $push: { log: { $each: ["✗ worker restarted while this job was running"], $slice: -LOG_LINES } },
    },
  );
  if (stale.modifiedCount) console.log(`Marked ${stale.modifiedCount} stale running job(s) as failed`);

  let current: StudioJob | null = null;
  process.on("SIGINT", () => {
    if (!stopping) {
      stopping = true;
      console.log(current ? "\nStopping after the current job (Ctrl-C again to abort it)" : "\nStopping");
      wake?.();
      return;
    }
    if (current) {
      const id = current._id;
      console.log("\nAborting the current job");
      void jobs
        .updateOne({ _id: id, status: "running" }, { $set: { status: "failed", error: "Aborted (worker stopped)", finishedAt: new Date() } })
        .finally(() => client.close().finally(() => process.exit(130)));
    } else {
      process.exit(130);
    }
  });

  console.log(`studio worker ${WORKER_ID} on ${MONGODB_DB}.studio_jobs${DRY_RUN ? " (DRY RUN: no Claude, ElevenLabs, Remotion or bucket)" : ""}`);
  console.log("Waiting for jobs; Ctrl-C to stop");
  while (!stopping) {
    current = await claim(jobs);
    if (!current) {
      await idle(POLL_MS);
      continue;
    }
    await work(jobs, current);
    current = null;
  }
  await client.close();
  console.log("Worker stopped");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
