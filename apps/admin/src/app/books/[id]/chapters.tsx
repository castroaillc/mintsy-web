"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChapterRow } from "@/lib/catalog";
import { callApi } from "@/lib/client-api";

export function ChaptersTable({
  bookId,
  chapters,
  canQueue,
}: {
  bookId: string;
  chapters: ChapterRow[];
  canQueue: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);

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
    router.refresh();
  }

  if (chapters.length === 0) {
    return <p className="px-4 pb-2 text-sm text-muted-foreground">No chapters yet. They appear once the ingest succeeds.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 pl-4">#</TableHead>
          <TableHead>Chapter</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="pr-4 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {chapters.map((c) => {
          const disabled = !canQueue || c.active || pending === c.number;
          return (
            <TableRow key={c.number}>
              <TableCell className="pl-4 align-top tabular-nums text-muted-foreground">{c.number}</TableCell>
              <TableCell className="max-w-md align-top whitespace-normal">
                <div className="font-medium">{c.title}</div>
                {c.error && <p className="mt-1 line-clamp-3 text-xs text-destructive">{c.latestJobKind} failed: {c.error}</p>}
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
  );
}
