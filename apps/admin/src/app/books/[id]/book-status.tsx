"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { callApi } from "@/lib/client-api";
import type { ContentStatus } from "@/lib/types";

export function BookStatusToggle({
  bookId,
  status,
  liveEpisodes,
  totalEpisodes,
}: {
  bookId: string;
  status: ContentStatus;
  liveEpisodes: number;
  totalEpisodes: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const published = status === "published";

  async function toggle(next: boolean) {
    if (next && !confirm(`Publish this book? It goes live in the app immediately${liveEpisodes ? ` with ${liveEpisodes} episode(s)` : ""}.`)) return;
    setBusy(true);
    const res = await callApi(`/api/books/${bookId}/status`, { method: "POST", body: { status: next ? "published" : "draft" } });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(next ? "Book published" : "Book unpublished");
    router.refresh();
  }

  return (
    <Card className={published ? "ring-success/30" : undefined}>
      <CardHeader>
        <CardTitle>Book status</CardTitle>
        <CardDescription>Publishing goes live in the app immediately.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="book-published" className="flex-col items-start gap-0.5">
            <span>{published ? "Published" : "Draft"}</span>
            <span className="text-xs font-normal text-muted-foreground">{published ? "Visible in the app" : "Hidden from the app"}</span>
          </Label>
          <Switch id="book-published" checked={published} disabled={busy} onCheckedChange={toggle} />
        </div>
        <p className="text-xs text-muted-foreground">
          {liveEpisodes} of {totalEpisodes} episode{totalEpisodes === 1 ? "" : "s"} live (the contiguous published run from episode 1).
          {published && liveEpisodes === 0 && " The app hides a book with no live episodes."}
        </p>
      </CardContent>
    </Card>
  );
}
