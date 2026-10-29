"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/badges";
import { formatDuration, Time } from "@/components/time";
import { WorkerBanner } from "@/components/worker-banner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useJobs } from "@/hooks/use-jobs";
import type { JobView } from "@/lib/types";
import { cn } from "@/lib/utils";

function duration(j: JobView, now: number) {
  if (!j.startedAt) return j.status === "queued" ? `waiting ${formatDuration(now - Date.parse(j.createdAt))}` : "—";
  const end = j.finishedAt ? Date.parse(j.finishedAt) : now;
  return formatDuration(end - Date.parse(j.startedAt));
}

export function JobsTable({ initialJobs, initialNow }: { initialJobs: JobView[]; initialNow: string }) {
  const { jobs, now, active } = useJobs(initialJobs, { initialNow });
  const [open, setOpen] = useState<Set<string>>(() => new Set(initialJobs.filter((j) => j.status === "running").map((j) => j.id)));
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-4">
      <WorkerBanner jobs={jobs} now={now} />
      <p className="text-xs text-muted-foreground">{active ? "Refreshing every 2 seconds." : "Idle. Checking every 10 seconds."}</p>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 pl-4" />
              <TableHead>Kind</TableHead>
              <TableHead>Book</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="pr-4 text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No jobs yet.
                </TableCell>
              </TableRow>
            )}
            {jobs.map((j) => {
              const isOpen = open.has(j.id);
              return (
                <Fragment key={j.id}>
                  <TableRow className="cursor-pointer" onClick={() => toggle(j.id)} aria-expanded={isOpen}>
                    <TableCell className="pl-4">
                      <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {j.kind}
                      {j.regenerate && <span className="ml-1.5 text-xs text-muted-foreground">regenerate</span>}
                      {j.hasEdits && <span className="ml-1.5 text-xs text-muted-foreground">edited</span>}
                    </TableCell>
                    <TableCell>
                      <Link href={`/books/${j.bookId}`} className="font-mono text-xs hover:text-brand" onClick={(e) => e.stopPropagation()}>
                        {j.bookId}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{j.chapter ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={j.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Time iso={j.createdAt} />
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">{duration(j, now)}</TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="bg-background/40 px-4 whitespace-normal">
                        {j.error && <p className="mb-2 text-sm text-destructive">Error: {j.error}</p>}
                        <div className="mb-2 flex flex-wrap gap-x-4 text-xs text-faint">
                          <span className="font-mono">{j.id}</span>
                          {j.workerId && <span>worker {j.workerId}</span>}
                          {j.pdfPath && <span className="font-mono">{j.pdfPath}</span>}
                        </div>
                        <pre className="max-h-80 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                          {j.log.length ? j.log.join("\n") : "No output yet."}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
