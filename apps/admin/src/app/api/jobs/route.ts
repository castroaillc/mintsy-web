import { NextResponse } from "next/server";
import type { Filter } from "mongodb";
import { env } from "@/lib/env";
import { listJobs, listLiveWorkers, toJobView } from "@/lib/jobs";
import type { StudioJob } from "@/lib/types";

/** GET /api/jobs[?bookId=…] → jobs newest first, the live studio workers and the database name. Polled by the Jobs page and the book page. */
export async function GET(req: Request) {
  const bookId = new URL(req.url).searchParams.get("bookId");
  const filter: Filter<StudioJob> = bookId ? { bookId } : {};
  const [jobs, workers] = await Promise.all([listJobs(filter, 300), listLiveWorkers()]);
  return NextResponse.json({ jobs: jobs.map(toJobView), workers, db: env.mongodbDb, now: new Date().toISOString() });
}
