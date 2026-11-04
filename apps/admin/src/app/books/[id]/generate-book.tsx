"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleSlash, Clapperboard, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useJobs } from "@/hooks/use-jobs";
import { callApi } from "@/lib/client-api";
import {
  applySelection,
  CLAUDE_COST_USD,
  describeChapterFailure,
  latestRun,
  SKIP_LABEL,
  summarizePlan,
  type PlannedChapter,
} from "@/lib/generate-all";
import type { JobView } from "@/lib/types";
import { cn } from "@/lib/utils";

type Plan = { chapters: PlannedChapter[]; workerDryRun: boolean; workerProblem: string | null };
type ChapterTitle = { number: number; title: string };

const usdRange = ({ low, high }: { low: number; high: number }) => `$${low.toFixed(2)}-$${high.toFixed(2)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Generate whole book": queues what's missing as local previews, shows the run's progress, cancels the queue. */
export function GenerateBook({
  bookId,
  chapters,
  initialJobs,
  initialNow,
}: {
  bookId: string;
  chapters: ChapterTitle[];
  initialJobs: JobView[];
  initialNow: string;
}) {
  const router = useRouter();
  const { jobs, workers } = useJobs(initialJobs, { bookId, initialNow });
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [unselected, setUnselected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const noWorker = workers != null && workers.length === 0;
  const queuedCount = jobs.filter((j) => j.status === "queued").length;
  const run = latestRun(jobs);
  const failures = [...run.byChapter.entries()]
    .map(([number, chapterJobs]) => ({ number, message: describeChapterFailure(chapterJobs) }))
    .filter((f): f is { number: number; message: string } => f.message !== null)
    .sort((a, b) => a.number - b.number);
  const titleOf = (n: number) => chapters.find((c) => c.number === n)?.title ?? "";

  async function openDialog() {
    setPlan(null);
    setUnselected(new Set());
    setOpen(true);
    const res = await callApi<Plan>(`/api/books/${bookId}/jobs/all`, { method: "GET" });
    if (!res.ok) {
      setOpen(false);
      return void toast.error(res.error);
    }
    setPlan(res.data);
  }

  async function confirmQueue() {
    if (!plan) return;
    setBusy(true);
    const selected = plan.chapters.filter((c) => !unselected.has(c.number)).map((c) => c.number);
    const res = await callApi<{ queued: number; scripts: number; renders: number }>(`/api/books/${bookId}/jobs/all`, {
      method: "POST",
      body: { chapters: selected },
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setOpen(false);
    toast.success(`Queued ${plural(res.data.scripts, "script")} and ${plural(res.data.renders, "preview render")}`);
    router.refresh();
  }

  async function cancelQueued() {
    if (!confirm(`Cancel ${plural(queuedCount, "queued job")} for this book? The job that's running finishes. Clicking Generate whole book later queues only what's still missing.`)) return;
    setBusy(true);
    const res = await callApi<{ deleted: number }>(`/api/books/${bookId}/jobs/all`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Cancelled ${plural(res.data.deleted, "queued job")}`);
    router.refresh();
  }

  const finished = run.succeeded + run.failed;
  const showProgress = run.total > 1 || run.queued > 0 || run.running || run.failed > 0;

  return (
    <div className="space-y-3 border-b px-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={noWorker || workers == null || busy} onClick={openDialog}>
          <Clapperboard /> Generate whole book
        </Button>
        {queuedCount > 0 && (
          <Button size="sm" variant="outline" disabled={busy} onClick={cancelQueued}>
            <CircleSlash /> Cancel queued jobs ({queuedCount})
          </Button>
        )}
        {noWorker && <span className="text-xs text-muted-foreground">Start the studio worker first: nothing runs without it.</span>}
      </div>

      {showProgress && (
        <div className="space-y-1.5" data-testid="book-progress">
          <p className="text-sm">
            <span className="font-medium">
              {run.succeeded} of {plural(run.total, "job")} done
              {run.failed > 0 && `, ${run.failed} failed`}
            </span>
            {run.running && (
              <span className="text-muted-foreground">
                {" "}
                · {run.running.kind === "script" ? "writing the script for" : "rendering"} chapter {run.running.chapter}
              </span>
            )}
          </p>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-brand transition-all" style={{ width: `${(run.succeeded / run.total) * 100}%` }} />
            <div className="h-full bg-destructive transition-all" style={{ width: `${(run.failed / run.total) * 100}%` }} />
          </div>
          {finished === run.total && failures.length === 0 && (
            <p className="text-xs text-muted-foreground">Finished. Review each preview on its chapter page, then upload it from there.</p>
          )}
        </div>
      )}

      {failures.length > 0 && (
        <Alert variant="destructive" data-testid="book-failures">
          <TriangleAlert />
          <AlertDescription className="space-y-2">
            <ul className="space-y-1.5">
              {failures.map((f) => (
                <li key={f.number}>
                  <Link href={`/books/${bookId}/chapters/${f.number}`} className="font-medium underline underline-offset-2">
                    Chapter {f.number}
                    {titleOf(f.number) && `: ${titleOf(f.number)}`}
                  </Link>
                  <span className="block text-xs">{f.message}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs">Later chapters keep going. Retry queues only what&apos;s still missing, so finished work isn&apos;t paid for again.</p>
            <Button size="sm" variant="outline" disabled={noWorker || workers == null || busy} onClick={openDialog}>
              <RotateCcw /> Retry failed
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Generate whole book</DialogTitle>
            <DialogDescription>
              Queues jobs for the studio worker, in chapter order. The result is local previews: nothing is uploaded or published, and no episode changes.
            </DialogDescription>
          </DialogHeader>
          {plan ? (
            <PlanDetails plan={plan} unselected={unselected} onChange={setUnselected} />
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Checking what each chapter needs
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <QueueButton plan={plan} unselected={unselected} busy={busy} onClick={confirmQueue} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function selection(plan: Plan, unselected: Set<number>) {
  return applySelection(
    plan.chapters,
    plan.chapters.filter((c) => !unselected.has(c.number)).map((c) => c.number),
  );
}

function QueueButton({ plan, unselected, busy, onClick }: { plan: Plan | null; unselected: Set<number>; busy: boolean; onClick: () => void }) {
  const summary = plan ? summarizePlan(selection(plan, unselected)) : null;
  const total = summary ? summary.scripts + summary.renders : 0;
  return (
    <Button disabled={!plan || !!plan.workerProblem || total === 0 || busy} onClick={onClick}>
      {busy && <Loader2 className="animate-spin" />}
      {total === 0 ? "Nothing to queue" : `Queue ${plural(total, "job")}`}
    </Button>
  );
}

function PlanDetails({ plan, unselected, onChange }: { plan: Plan; unselected: Set<number>; onChange: (next: Set<number>) => void }) {
  const chosen = selection(plan, unselected);
  const summary = summarizePlan(chosen);
  const pickable = plan.chapters.filter((c) => !c.skip);
  const skippedChapters = chosen.filter((c) => c.skip);
  const lastSelected = Math.max(0, ...chosen.filter((c) => !c.skip).map((c) => c.number));
  const gap = [...unselected].some((n) => n < lastSelected);
  const rebuilds = chosen.filter((c) => c.scriptFilesMissing).length;
  const { full, scenesOnly } = CLAUDE_COST_USD;

  return (
    <div className="max-h-[60vh] space-y-3 overflow-auto text-sm" data-testid="generate-plan">
      {plan.workerProblem && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{plan.workerProblem}</AlertDescription>
        </Alert>
      )}
      {plan.workerDryRun && <p className="text-xs text-muted-foreground">The worker is in dry-run mode: these jobs produce fake results and cost nothing.</p>}

      <ul className="space-y-1.5">
        <li>
          <span className="font-medium">{plural(summary.scripts, "chapter")} will get a script</span>: paid Claude calls.
          {summary.fullChapters + summary.scenesOnlyChapters > 0 && (
            <>
              {" "}
              {summary.fullChapters > 0 && `Approximately ${usdRange(full)} per chapter for script and scenes, based on past runs${summary.scenesOnlyChapters > 0 ? "; " : ", "}`}
              {summary.scenesOnlyChapters > 0 &&
                `${summary.fullChapters > 0 ? "" : "Approximately "}${usdRange(scenesOnly)} per chapter for the ${plural(summary.scenesOnlyChapters, "chapter")} that already ${summary.scenesOnlyChapters === 1 ? "has a script and needs" : "have a script and need"} only scenes${summary.fullChapters > 0 ? ", " : ", based on past runs, "}`}
              so about {usdRange(summary.cost)}.
            </>
          )}
        </li>
        <li>
          <span className="font-medium">{plural(summary.renders, "chapter")} will render a preview</span>: local narration and rendering with no per-use cost. Each one
          renders a video per voice on this machine, about three times as long as a single video.
        </li>
        <li>
          <span className="font-medium">{plural(skippedChapters.length, "chapter")} skipped</span>
          {summary.skipped.length > 0 && `: ${summary.skipped.map((s) => `${s.count} ${SKIP_LABEL[s.reason]}`).join(", ")}`}.
        </li>
      </ul>

      {rebuilds > 0 && (
        <p className="text-xs text-destructive">
          {plural(rebuilds, "chapter has", "chapters have")} a finished script job but no script files in apps/studio/work. The render job writes them again with Claude.
        </p>
      )}

      <Alert className="border-brand/40 bg-brand/10 text-foreground">
        <TriangleAlert className="text-brand" />
        <AlertDescription className="space-y-1 text-xs text-foreground">
          <p>This skips the per-chapter script review: scripts go straight to rendering. Review each preview on its chapter page, then upload it from there.</p>
          <p>If a script job fails, that chapter&apos;s render job tries the script again, so a failure can cost one more paid call. Later chapters keep going.</p>
        </AlertDescription>
      </Alert>

      {pickable.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="pb-1 text-xs text-muted-foreground">Chapters to generate. Untick anything that isn&apos;t worth an episode, such as a very short summary.</legend>
          <div className="max-h-48 space-y-0.5 overflow-auto rounded-lg border p-2">
            {pickable.map((c) => (
              <label key={c.number} className={cn("flex cursor-pointer items-baseline gap-2 rounded px-1 py-0.5 hover:bg-muted", unselected.has(c.number) && "text-muted-foreground")}>
                <input
                  type="checkbox"
                  className="translate-y-0.5 accent-[var(--brand)]"
                  checked={!unselected.has(c.number)}
                  onChange={(e) => {
                    const next = new Set(unselected);
                    if (e.target.checked) next.delete(c.number);
                    else next.add(c.number);
                    onChange(next);
                  }}
                />
                <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{c.number}</span>
                <span className="min-w-0 flex-1">{c.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.script ? "script + render" : "render"}
                  {c.pages != null && ` · ${plural(c.pages, "page")}`}
                </span>
              </label>
            ))}
          </div>
          {gap && (
            <p className="text-xs text-muted-foreground">
              Episodes go live only in order from episode 1, so a chapter left out here blocks publishing the ones after it until it has an episode.
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
