"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Paintbrush } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/badges";
import { JobLog } from "@/components/job-log";
import { Time } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useJobs } from "@/hooks/use-jobs";
import { callApi } from "@/lib/client-api";
import type { JobView } from "@/lib/types";

/** Book cover: the local render (studio/work) next to the one the apps show, with render/publish actions. */
export function BookCoverCard({
  bookId,
  local,
  publishedUrl,
  bookLive,
  initialJobs,
  initialNow,
}: {
  bookId: string;
  local: { version: number; renderedAt: string } | null;
  publishedUrl: string | null;
  bookLive: boolean;
  initialJobs: JobView[];
  initialNow: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { jobs } = useJobs(initialJobs, { bookId, initialNow, onStatusChange: () => router.refresh() });
  const latest = jobs.find((j) => j.kind === "cover") ?? null;
  const active = latest?.status === "queued" || latest?.status === "running";

  async function queue(upload: boolean) {
    if (upload && !confirm(bookLive ? "Publish this cover? The book is live, so the apps show it right away." : "Upload this cover? It shows in the apps once the book is published.")) return;
    setPending(true);
    const res = await callApi(`/api/books/${bookId}/cover`, { method: "POST", body: upload ? { upload: true } : {} });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(upload ? "Cover job queued: render + publish" : "Cover render queued");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cover</CardTitle>
        <CardDescription>Rendered from the title, author, category and cover tone. Save metadata changes, then render again.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <figure className="space-y-1">
            {local ? (
              // eslint-disable-next-line @next/next/no-img-element -- local render, served by the dashboard
              <img src={`/api/books/${bookId}/cover?v=${local.version}`} alt="" className="aspect-[2/3] w-full rounded-md object-cover" />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">Not rendered</div>
            )}
            <figcaption className="text-xs text-muted-foreground">
              Preview{local && <> · <Time iso={local.renderedAt} /></>}
            </figcaption>
          </figure>
          <figure className="space-y-1">
            {publishedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- bucket image
              <img src={publishedUrl} alt="" className="aspect-[2/3] w-full rounded-md object-cover" />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-md border border-dashed p-2 text-center text-xs text-muted-foreground">
                Not published: the apps draw the tone tile
              </div>
            )}
            <figcaption className="text-xs text-muted-foreground">In the apps</figcaption>
          </figure>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={active || pending} onClick={() => queue(false)}>
            {pending ? <Loader2 className="animate-spin" /> : <Paintbrush />} Render
          </Button>
          <Button size="sm" disabled={active || pending} onClick={() => queue(true)}>
            <ImageUp /> Render + publish
          </Button>
        </div>
        {latest && (
          <div className="space-y-1.5 border-t pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Last cover job <StatusBadge status={latest.status} /> <Time iso={latest.createdAt} />
            </div>
            {latest.error && <p className="text-xs text-destructive">{latest.error}</p>}
            <JobLog lines={latest.log} follow={active} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
