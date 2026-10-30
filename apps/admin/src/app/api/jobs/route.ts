import { NextResponse } from "next/server";
import type { Filter } from "mongodb";
import { listJobs, toJobView } from "@/lib/jobs";
import type { StudioJob } from "@/lib/types";

/** GET /api/jobs[?bookId=…] → newest first. Polled by the Jobs page and the book page. */
export async function GET(req: Request) {
  const bookId = new URL(req.url).searchParams.get("bookId");
  const filter: Filter<StudioJob> = bookId ? { bookId } : {};
  const jobs = await listJobs(filter, 300);
  return NextResponse.json({ jobs: jobs.map(toJobView), now: new Date().toISOString() });
}
