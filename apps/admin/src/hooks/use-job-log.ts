"use client";

import { useEffect, useState } from "react";
import type { JobView } from "@/lib/types";

/** Finished jobs' logs by job id. The worker writes the last lines before it marks a job finished, so they don't change. */
const finishedLogs = new Map<string, Promise<string[]>>();

function fetchLog(id: string) {
  let p = finishedLogs.get(id);
  if (!p) {
    p = fetch(`/api/jobs/${id}/log`, { cache: "no-store" }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { log: string[] }).log;
    });
    // A failed fetch is retried the next time the log is shown.
    p.catch(() => finishedLogs.delete(id));
    finishedLogs.set(id, p);
  }
  return p;
}

/**
 * A job's whole log. Polls carry it only while the job is queued or running; for a finished job it's
 * fetched once `enabled` is true. Null while that fetch is pending (or failed).
 */
export function useJobLog(job: JobView, enabled: boolean): string[] | null {
  const [loaded, setLoaded] = useState<{ id: string; log: string[] } | null>(null);
  // The last log a poll carried, shown while a job that just finished has its final log fetched.
  const [live, setLive] = useState<{ id: string; log: string[] } | null>(null);
  if (job.log && (live?.id !== job.id || live.log !== job.log)) setLive({ id: job.id, log: job.log });
  const need = enabled && !job.log;
  useEffect(() => {
    if (!need) return;
    let cancelled = false;
    fetchLog(job.id).then(
      (log) => !cancelled && setLoaded({ id: job.id, log }),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [need, job.id]);
  if (job.log) return job.log;
  if (loaded?.id === job.id) return loaded.log;
  return live?.id === job.id ? live.log : null;
}
