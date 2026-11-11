"use client";

import { useEffect, useRef, useState } from "react";
import type { JobView, WorkerView } from "@/lib/types";

const ACTIVE_MS = 2000;
const IDLE_MS = 10000;

type JobsResponse = { jobs: JobView[]; workers: WorkerView[]; db: string; now: string };

/**
 * One request per URL at a time, shared by every hook on the page (the book page has three), and an
 * answer under a second old is reused rather than asked for again.
 */
const shared = new Map<string, { inflight?: Promise<JobsResponse | null>; at: number; data?: JobsResponse }>();
const REUSE_MS = 1000;

function fetchJobs(url: string): Promise<JobsResponse | null> {
  const entry = shared.get(url) ?? { at: 0 };
  shared.set(url, entry);
  if (entry.inflight) return entry.inflight;
  if (entry.data && Date.now() - entry.at < REUSE_MS) return Promise.resolve(entry.data);
  entry.inflight = fetch(url, { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as JobsResponse;
      entry.data = data;
      entry.at = Date.now();
      return data;
    })
    .finally(() => {
      entry.inflight = undefined;
    });
  return entry.inflight;
}

function signature(jobs: JobView[]) {
  return jobs.map((j) => `${j.id}:${j.status}`).join("|");
}

/**
 * Polls /api/jobs ~2s after the last answer while anything is queued or running (10s otherwise).
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The next poll is scheduled when this one ends, so a slow answer can't make requests pile up.
    const tick = async () => {
      try {
        const data = await fetchJobs(url);
        if (!data || cancelled) return;
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
      } finally {
        if (!cancelled) timer = setTimeout(tick, active ? ACTIVE_MS : IDLE_MS);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
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
