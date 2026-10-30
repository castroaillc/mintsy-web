import type { Metadata } from "next";
import { listJobs, toJobView } from "@/lib/jobs";
import { JobsTable } from "./jobs-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage() {
  const jobs = await listJobs({}, 300);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Studio jobs in <code className="font-mono text-xs">studio_jobs</code>, newest first. The studio worker runs one at a time.
        </p>
      </div>
      <JobsTable initialJobs={jobs.map(toJobView)} initialNow={new Date().toISOString()} />
    </div>
  );
}
