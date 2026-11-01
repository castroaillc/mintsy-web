"use client";

import { useEffect, useRef, useState } from "react";
import type { JobView, WorkerView } from "@/lib/types";

const ACTIVE_MS = 2000;
const IDLE_MS = 10000;

function signature(jobs: JobView[]) {
  return jobs.map((j) => `${j.id}:${j.status}`).join("|");
}

/**
 * Polls /api/jobs every ~2s while anything is queued or running (every 10s otherwise).
 * `onSettled` fires when any job changes status, so pages can router.refresh() their server data.
 */
export function useJobs(initial: JobView[], opts: { bookId?: string; initialNow: string; onStatusChange?: () => void }) {
  const [jobs, setJobs] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(opts.initialNow));
  // Unknown (null) until the first poll answers.
  const [workers, setWorkers] = useState<WorkerView[] | null>(null);
  const [db, setDb] = useState<string | null>(null);
  const sig = useRef(signature(initial));
  const onChange = useRef(opts.onStatusChange);
  useEffect(() => {
    onChange.current = opts.onStatusChange;
  });

  const active = jobs.some((j) => j.status === "queued" || j.status === "running");

  useEffect(() => {
    let cancelled = false;
    const url = opts.bookId ? `/api/jobs?bookId=${encodeURIComponent(opts.bookId)}` : "/api/jobs";
    const tick = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { jobs: JobView[]; workers: WorkerView[]; db: string; now: string };
        if (cancelled) return;
        setJobs(data.jobs);
        setWorkers(data.workers);
        setDb(data.db);
        setNow(Date.parse(data.now));
        const next = signature(data.jobs);
        if (next !== sig.current) {
          sig.current = next;
          onChange.current?.();
        }
      } catch {
        // dev server restarting etc.; try again next tick
      }
    };
    void tick();
    const t = setInterval(tick, active ? ACTIVE_MS : IDLE_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [active, opts.bookId]);

  // Keep the local list in sync when the server component re-renders with fresh data.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setJobs(initial);
  }
  useEffect(() => {
    sig.current = signature(initial);
  }, [initial]);

  return { jobs, active, now, workers, db };
}
