"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ChapterRow } from "@/lib/catalog";
import { callApi } from "@/lib/client-api";
import { checkEpisodeSelection, formatList } from "@/lib/status";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Drafts that can go live together: walking up from episode 1 over published episodes and drafts, up to
 * the first chapter with no episode or with a job at work (a render would replace that draft).
 * Anything after that can't join the contiguous run yet.
 */
export function publishableDrafts(chapters: ChapterRow[]): number[] {
  const byNumber = new Map(chapters.map((c) => [c.number, c]));
  const out: number[] = [];
  for (let n = 1; ; n++) {
    const c = byNumber.get(n);
    if (!c?.episodeStatus) break;
    if (c.episodeStatus === "published") continue;
    if (c.active) break;
    out.push(n);
  }
  return out;
}

export function SelectAllBox({
  publishable,
  selection,
  onChange,
}: {
  publishable: number[];
  selection: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const all = publishable.length > 0 && publishable.every((n) => selection.has(n));
  const some = selection.size > 0 && !all;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="translate-y-0.5 accent-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="Select all publishable drafts"
      title={publishable.length ? `Select episodes ${formatList(publishable)}` : "No draft can be published yet"}
      disabled={publishable.length === 0}
      checked={all}
      onChange={() => onChange(all || some ? new Set() : new Set(publishable))}
    />
  );
}

export function BulkPublishBar({
  bookId,
  chapters,
  selection,
  bookPublished,
  onDone,
}: {
  bookId: string;
  chapters: ChapterRow[];
  selection: Set<number>;
  bookPublished: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const numbers = [...selection].sort((a, b) => a - b);
  // The order rule only; the route also checks the values the API must serve, and its reason is shown on refusal.
  const rule = numbers.length
    ? checkEpisodeSelection(
        chapters.filter((c) => c.episodeStatus).map((c) => ({ number: c.number, status: c.episodeStatus ?? undefined })),
        numbers,
      )
    : null;
  const titles = new Map(chapters.map((c) => [c.number, c.title]));

  function openDialog() {
    setRefusal(null);
    setOpen(true);
  }

  async function publish() {
    setBusy(true);
    setRefusal(null);
    const res = await callApi(`/api/books/${bookId}/episodes/status`, { method: "POST", body: { numbers, status: "published" } });
    setBusy(false);
    if (!res.ok) {
      setRefusal(res.error);
      toast.error("Nothing was published");
      return;
    }
    toast.success(`Published ${numbers.length === 1 ? "episode" : "episodes"} ${formatList(numbers)}`);
    setOpen(false);
    onDone();
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4">
      <p className="text-xs text-muted-foreground">
        {numbers.length === 0
          ? "Tick drafts to publish several at once. The box in the header selects every draft that can go live in order."
          : rule && !rule.ok
            ? <span className="text-destructive">{rule.reason}</span>
            : `${plural(numbers.length, "episode")} selected: ${formatList(numbers)}.`}
      </p>
      <Button size="sm" disabled={!rule?.ok || busy} onClick={openDialog}>
        <Upload /> {numbers.length ? `Publish ${plural(numbers.length, "episode")}` : "Publish episodes"}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish {plural(numbers.length, "episode")}?</DialogTitle>
            <DialogDescription>
              {bookPublished
                ? "They go live in the app immediately, for every user on their next fetch."
                : "The book is a draft, so the app shows them only once the book is published. That also goes live immediately."}{" "}
              Episodes {formatList(numbers)}. All of them are published, or none is.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-56 space-y-0.5 overflow-auto rounded-lg border p-2 text-sm">
            {numbers.map((n) => (
              <li key={n} className="flex items-baseline gap-2">
                <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{n}</span>
                <span className="min-w-0 flex-1">{titles.get(n)}</span>
              </li>
            ))}
          </ul>
          {refusal && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription className="break-words" role="alert">
                {refusal}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !!refusal} onClick={publish}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />} Publish {plural(numbers.length, "episode")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
