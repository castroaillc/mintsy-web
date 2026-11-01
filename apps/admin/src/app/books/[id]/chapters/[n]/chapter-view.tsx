"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, CircleDashed, Clapperboard, CloudUpload, FileText, Loader2, Pencil, Radio, RotateCcw, SkipForward, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/badges";
import { JobLog } from "@/components/job-log";
import { Time, formatDuration } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkerBanner } from "@/components/worker-banner";
import { useJobs } from "@/hooks/use-jobs";
import type { ChapterRow } from "@/lib/catalog";
import { callApi } from "@/lib/client-api";
import { jobSteps, type JobStep, type StepState } from "@/lib/job-steps";
import type { JobView } from "@/lib/types";
import type { LocalPreview as Preview } from "@/lib/studio-work";
import { cn } from "@/lib/utils";
import { LocalPreview } from "./local-preview";

type ScriptPreview = { finishedAt: string; script: unknown; scenes: unknown } | null;

export function ChapterView({
  bookId,
  chapter,
  initialJobs,
  initialNow,
  script,
  preview,
}: {
  bookId: string;
  chapter: ChapterRow;
  initialJobs: JobView[];
  initialNow: string;
  script: ScriptPreview;
  preview: Preview;
}) {
  const router = useRouter();
  const [queueing, setQueueing] = useState(false);
  // Polls the whole book's jobs; this page only shows this chapter's.
  const { jobs: allJobs, now, workers, db } = useJobs(initialJobs, {
    bookId,
    initialNow,
    onStatusChange: () => router.refresh(),
  });
  const jobs = allJobs.filter((j) => j.chapter === chapter.number && j.kind !== "ingest");
  const latest = jobs[0] ?? null;
  const active = latest?.status === "queued" || latest?.status === "running";

  // The local render was uploaded if an upload (or full render) finished after it was written
  const lastUpload = jobs.find((j) => j.status === "succeeded" && (j.kind === "upload" || (j.kind === "render" && !j.preview)));
  const uploaded =
    !!preview.video && !!lastUpload?.finishedAt && Date.parse(lastUpload.finishedAt) >= Date.parse(preview.video.renderedAt) - 1000;

  async function queue(body: Record<string, unknown>, done: string) {
    setQueueing(true);
    const res = await callApi(`/api/books/${bookId}/jobs`, { method: "POST", body: { chapter: chapter.number, ...body } });
    setQueueing(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(done);
    router.refresh();
  }

  async function renderPreview() {
    await queue({ kind: "render", preview: true }, "Preview render queued");
  }

  async function upload() {
    const live = chapter.episodeStatus === "published";
    if (!confirm(`Upload this render of chapter ${chapter.number} and save it as a draft episode?${live ? " The episode is live: it returns to draft (hiding it and later episodes in the app) until you publish it again." : ""}`)) return;
    await queue({ kind: "upload" }, "Upload queued");
  }

  async function publish() {
    if (!confirm(`Publish episode ${chapter.number}? It shows in the mobile and web apps right away (if the book is published).`)) return;
    setQueueing(true);
    const res = await callApi(`/api/books/${bookId}/episodes/${chapter.number}/status`, { method: "POST", body: { status: "published" } });
    setQueueing(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Episode ${chapter.number} published`);
    router.refresh();
  }

  async function queueScript(regenerate: boolean) {
    if (regenerate && !confirm(`Regenerate the script for chapter ${chapter.number}? The current script and any unrendered edits are replaced.`)) return;
    setQueueing(true);
    const res = await callApi(`/api/books/${bookId}/jobs`, {
      method: "POST",
      body: { kind: "script", chapter: chapter.number, ...(regenerate ? { regenerate: true } : {}) },
    });
    setQueueing(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Script job queued");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={chapter.state} />
        {chapter.episodeStatus && chapter.state !== chapter.episodeStatus && <StatusBadge status={chapter.episodeStatus} />}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {!chapter.hasScript && (
            <Button size="sm" disabled={active || queueing} onClick={() => queueScript(false)}>
              {queueing ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate script
            </Button>
          )}
          {chapter.hasScript && (
            <Button size="sm" variant={chapter.state === "script ready" ? "default" : "outline"} asChild>
              <Link href={`/books/${bookId}/chapters/${chapter.number}/script`}>
                <FileText /> Review script
              </Link>
            </Button>
          )}
          {chapter.hasScript && (
            <Button size="sm" variant="ghost" disabled={active || queueing} onClick={() => queueScript(true)}>
              <RotateCcw /> Regenerate
            </Button>
          )}
          {chapter.hasScript && (
            <Button size="sm" variant={preview.video ? "outline" : "default"} disabled={active || queueing} onClick={renderPreview}>
              <Clapperboard /> {preview.video ? "Re-render preview" : "Render preview"}
            </Button>
          )}
          {preview.video && !uploaded && (
            <Button size="sm" disabled={active || queueing} onClick={upload}>
              <CloudUpload /> Upload as draft
            </Button>
          )}
          {uploaded && chapter.episodeStatus === "draft" && (
            <Button size="sm" disabled={active || queueing} onClick={publish}>
              <Radio /> Publish episode
            </Button>
          )}
          {chapter.episodeStatus && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/books/${bookId}/episodes/${chapter.number}`}>
                <Pencil /> Episode
              </Link>
            </Button>
          )}
        </div>
      </div>

      <WorkerBanner jobs={jobs} now={now} workers={workers} db={db} />

      {latest ? (
        <JobProgress job={latest} now={now} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing has run for this chapter yet. <span className="text-foreground">Generate script</span> to start; you can watch each step here.
          </CardContent>
        </Card>
      )}

      <LocalPreview bookId={bookId} chapter={chapter.number} preview={preview} />

      {script && <ScriptCard bookId={bookId} chapter={chapter.number} preview={script} />}

      {jobs.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Earlier jobs for this chapter, newest first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobs.slice(1).map((j) => (
              <div key={j.id} className="space-y-1.5 border-t pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium capitalize">{j.kind}</span>
                  <StatusBadge status={j.status} />
                  <span className="text-muted-foreground">
                    <Time iso={j.createdAt} />
                    {j.startedAt && j.finishedAt && ` · took ${formatDuration(Date.parse(j.finishedAt) - Date.parse(j.startedAt))}`}
                  </span>
                </div>
                {j.error && <p className="text-xs text-destructive">{j.error}</p>}
                <JobLog lines={j.log} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function JobProgress({ job, now }: { job: JobView; now: number }) {
  const steps = jobSteps(job);
  const done = steps.filter((s) => s.state === "done" || s.state === "skipped").length;
  const elapsed = job.startedAt ? (job.finishedAt ? Date.parse(job.finishedAt) : now) - Date.parse(job.startedAt) : null;
  const waiting = job.status === "queued" ? now - Date.parse(job.createdAt) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>
            {job.kind === "script" ? "Script generation" : job.kind === "upload" ? "Upload" : job.preview ? "Preview render" : "Render"}
          </CardTitle>
          <StatusBadge status={job.status} />
          {job.regenerate && <span className="text-xs text-muted-foreground">regenerate</span>}
        </div>
        <CardDescription>
          {job.status === "queued" && `Waiting for the studio worker · ${formatDuration(waiting ?? 0)}`}
          {job.status !== "queued" && (
            <>
              Step {Math.min(done + (job.status === "running" ? 1 : 0), steps.length)} of {steps.length}
              {elapsed != null && ` · ${job.status === "running" ? "running for" : "took"} ${formatDuration(elapsed)}`}
              {job.workerId && ` · ${job.workerId}`}
            </>
          )}
        </CardDescription>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", job.status === "failed" ? "bg-destructive" : "bg-brand")}
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="space-y-0">
          {steps.map((s, i) => (
            <StepItem key={s.name} step={s} last={i === steps.length - 1} />
          ))}
        </ol>
        {job.error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{job.error}</p>
        )}
        <JobLog lines={job.log} follow defaultOpen={job.status === "running" || job.status === "failed"} />
      </CardContent>
    </Card>
  );
}

const STEP_ICON: Record<StepState, React.ReactNode> = {
  pending: <Circle className="size-4 text-faint" />,
  running: <Loader2 className="size-4 animate-spin text-brand" />,
  done: <Check className="size-4 text-success" />,
  skipped: <SkipForward className="size-4 text-muted-foreground" />,
  failed: <X className="size-4 text-destructive" />,
};

function StepItem({ step, last }: { step: JobStep; last: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute top-6 bottom-0 left-[11px] w-px bg-border" aria-hidden />}
      <span
        className={cn(
          "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card",
          step.state === "running" && "border-brand/50",
          step.state === "failed" && "border-destructive/50",
        )}
      >
        {STEP_ICON[step.state] ?? <CircleDashed className="size-4" />}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn("text-sm font-medium", step.state === "pending" && "text-muted-foreground")}>{step.label}</span>
          <span className="text-xs text-faint">
            {step.state === "skipped" ? "already done, reused" : step.state === "running" ? "in progress" : step.state === "pending" ? "" : step.state}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{step.description}</p>
        {step.details.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 font-mono text-xs text-muted-foreground">
            {step.details.slice(-6).map((d, i) => (
              <li key={i} className="truncate" title={d}>
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function asScript(v: unknown) {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  const strs = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : []);
  return {
    title: typeof s.title === "string" ? s.title : "",
    summary: typeof s.summary === "string" ? s.summary : "",
    takeaways: strs(s.takeaways),
    narration: strs(s.narration),
  };
}

function ScriptCard({ bookId, chapter, preview }: { bookId: string; chapter: number; preview: NonNullable<ScriptPreview> }) {
  const s = asScript(preview.script);
  const sceneCount = Array.isArray(preview.scenes)
    ? preview.scenes.length
    : Array.isArray((preview.scenes as { scenes?: unknown[] } | null)?.scenes)
      ? (preview.scenes as { scenes: unknown[] }).scenes.length
      : null;
  if (!s) return null;
  const words = s.narration.join(" ").split(/\s+/).filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest script</CardTitle>
        <CardDescription>
          Generated <Time iso={preview.finishedAt} /> · {words} words (~{(words / 150).toFixed(1)} min)
          {sceneCount != null && ` · ${sceneCount} scenes`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-heading text-lg font-bold">{s.title}</h3>
          <p className="text-sm text-muted-foreground">{s.summary}</p>
        </div>
        {s.takeaways.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {s.takeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        )}
        <div className="max-h-96 space-y-3 overflow-auto rounded-lg border bg-background p-4 text-sm leading-relaxed">
          {s.narration.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/books/${bookId}/chapters/${chapter}/script`}>
            <Pencil /> Edit in script review
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
