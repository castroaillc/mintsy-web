"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/badges";
import { JobLog } from "@/components/job-log";
import { formatDuration, Time } from "@/components/time";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useJobs } from "@/hooks/use-jobs";
import type { JobView } from "@/lib/types";
import { WorkerBanner } from "@/components/worker-banner";

/**
 * Polls this book's jobs. Shows the latest ingest with its live log and refreshes the
 * server-rendered parts of the page (chapters, metadata) whenever a job changes status.
 */
export function IngestPanel({
  bookId,
  initialJobs,
  initialNow,
  hasBook,
}: {
  bookId: string;
  initialJobs: JobView[];
  initialNow: string;
  hasBook: boolean;
}) {
  const router = useRouter();
  const { jobs, now, workers, db } = useJobs(initialJobs, { bookId, initialNow, onStatusChange: () => router.refresh() });
  const ingest = jobs.find((j) => j.kind === "ingest");
  const running = ingest && (ingest.status === "queued" || ingest.status === "running");

  return (
    <div className="space-y-4">
      <WorkerBanner jobs={jobs} now={now} workers={workers} db={db} />
      {ingest ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Ingest <StatusBadge status={ingest.status} />
            </CardTitle>
            <CardDescription>
              Queued <Time iso={ingest.createdAt} />
              {ingest.finishedAt && ingest.startedAt && (
                <> · took {formatDuration(Date.parse(ingest.finishedAt) - Date.parse(ingest.startedAt))}</>
              )}
              {ingest.pdfPath && <span className="block font-mono text-xs text-faint">{ingest.pdfPath}</span>}
            </CardDescription>
            <CardAction>
              <Link href="/jobs" className="text-xs text-muted-foreground hover:text-foreground">
                All jobs →
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {ingest.status === "failed" && (
              <Alert variant="destructive">
                <AlertTitle>Ingest failed</AlertTitle>
                <AlertDescription>
                  <p>{ingest.error ?? "No error message."}</p>
                  {!hasBook && <p>Fix the problem, then upload the PDF again from New book with the same id.</p>}
                </AlertDescription>
              </Alert>
            )}
            {(running || ingest.status === "failed" || ingest.log.length > 0) && (
              <JobLog lines={ingest.log} follow={!!running} defaultOpen={!!running || ingest.status === "failed"} />
            )}
          </CardContent>
        </Card>
      ) : (
        !hasBook && <p className="text-sm text-muted-foreground">No ingest job for this book.</p>
      )}
    </div>
  );
}
