"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChapterRow } from "@/lib/catalog";
import { callApi } from "@/lib/client-api";
import { BulkPublishBar, SelectAllBox, publishableDrafts } from "./bulk-publish";

export function ChaptersTable({
  bookId,
  chapters,
  canQueue,
  bookPublished,
}: {
  bookId: string;
  chapters: ChapterRow[];
  canQueue: boolean;
  bookPublished: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const publishable = useMemo(() => publishableDrafts(chapters), [chapters]);
  const hasDrafts = chapters.some((c) => c.episodeStatus === "draft");
  // Drop anything that stopped being a selectable draft since it was ticked (a refresh, a render starting).
  const selection = useMemo(() => new Set([...selected].filter((n) => chapters.some((c) => c.number === n && c.episodeStatus === "draft" && !c.active))), [selected, chapters]);

  function toggle(n: number, on: boolean) {
    const next = new Set(selection);
    if (on) next.add(n);
    else next.delete(n);
    setSelected(next);
  }

  async function queueScript(c: ChapterRow, regenerate: boolean) {
    if (regenerate && !confirm(`Regenerate the script for chapter ${c.number}? The current script and any unrendered edits are replaced.`)) return;
    setPending(c.number);
    const res = await callApi(`/api/books/${bookId}/jobs`, {
      method: "POST",
      body: { kind: "script", chapter: c.number, ...(regenerate ? { regenerate: true } : {}) },
    });
    setPending(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Script job queued for chapter ${c.number}`);
    router.push(`/books/${bookId}/chapters/${c.number}`);
  }

  if (chapters.length === 0) {
    return <p className="px-4 pb-2 text-sm text-muted-foreground">No chapters yet. They appear once the ingest succeeds.</p>;
  }

  return (
    <div className="space-y-2">
      {hasDrafts && (
        <BulkPublishBar
          bookId={bookId}
          chapters={chapters}
          selection={selection}
          bookPublished={bookPublished}
          onDone={() => setSelected(new Set())}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {hasDrafts && (
              <TableHead className="w-8 pl-4">
                <SelectAllBox publishable={publishable} selection={selection} onChange={setSelected} />
              </TableHead>
            )}
            <TableHead className={hasDrafts ? "w-12" : "w-12 pl-4"}>#</TableHead>
            <TableHead>Chapter</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="pr-4 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {chapters.map((c) => {
            const disabled = !canQueue || c.active || pending === c.number;
            return (
              <TableRow key={c.number} data-state={selection.has(c.number) ? "selected" : undefined}>
                {hasDrafts && (
                  <TableCell className="pl-4 align-top">
                    <input
                      type="checkbox"
                      className="translate-y-0.5 accent-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Select episode ${c.number}`}
                      title={rowHint(c)}
                      disabled={c.episodeStatus !== "draft" || c.active}
                      checked={c.episodeStatus === "published" || selection.has(c.number)}
                      onChange={(e) => toggle(c.number, e.target.checked)}
                    />
                  </TableCell>
                )}
                <TableCell className={hasDrafts ? "align-top tabular-nums text-muted-foreground" : "pl-4 align-top tabular-nums text-muted-foreground"}>{c.number}</TableCell>
                <TableCell className="max-w-md align-top whitespace-normal">
                  <Link href={`/books/${bookId}/chapters/${c.number}`} className="font-medium hover:text-brand">
                    {c.title}
                  </Link>
                  {c.error && <p className="mt-1 line-clamp-3 text-xs text-destructive">{c.error}</p>}
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={c.state} />
                    {c.episodeStatus && c.state !== c.episodeStatus && (
                      <StatusBadge status={c.episodeStatus} className="opacity-80" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="pr-4 text-right align-top">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {!c.hasScript && (
                      <Button size="sm" variant="outline" disabled={disabled} onClick={() => queueScript(c, false)}>
                        <Sparkles /> Generate script
                      </Button>
                    )}
                    {c.hasScript && (
                      <Button size="sm" variant={c.state === "script ready" ? "default" : "outline"} asChild disabled={c.active}>
                        <Link href={`/books/${bookId}/chapters/${c.number}/script`} aria-disabled={c.active}>
                          <FileText /> Review script
                        </Link>
                      </Button>
                    )}
                    {c.hasScript && (
                      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => queueScript(c, true)}>
                        <RotateCcw /> Regenerate
                      </Button>
                    )}
                    {c.episodeStatus && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/books/${bookId}/episodes/${c.number}`}>
                          <Pencil /> Episode
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function rowHint(c: ChapterRow) {
  if (c.episodeStatus === "published") return "Already published";
  if (!c.episodeStatus) return "No episode yet";
  if (c.active) return "A job is running for this chapter";
  return `Select episode ${c.number} to publish`;
}
