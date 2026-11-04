"use client";

import { useState } from "react";
import { Loader2, RefreshCcw, TriangleAlert } from "lucide-react";
import { Time } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { transcriptRefusal } from "@/lib/remaster";
import type { ContentStatus, JobView, RemasterResult } from "@/lib/types";

/**
 * Remaster re-renders an episode from its local files and swaps its media in place, so the confirmation
 * says that it's immediate. Discarding transcript edits is offered only after a job has refused on them.
 */
export function RemasterPanel({
  chapter,
  episodeStatus,
  episodeUpdatedAt,
  jobs,
  busy,
  queue,
}: {
  chapter: number;
  episodeStatus: ContentStatus;
  episodeUpdatedAt: string | null;
  jobs: JobView[];
  busy: boolean;
  queue: (body: Record<string, unknown>, done: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<"remaster" | "overwrite" | null>(null);
  const last = jobs.find((j) => j.kind === "remaster");
  const refusal = transcriptRefusal(last, episodeUpdatedAt);
  const result = last?.status === "succeeded" ? (last.result as RemasterResult | undefined) : undefined;
  const live = episodeStatus === "published";

  async function run() {
    const overwrite = confirming === "overwrite";
    setConfirming(null);
    await queue({ kind: "remaster", ...(overwrite ? { overwriteTranscript: true } : {}) }, overwrite ? "Remaster queued, overwriting the transcript edits" : "Remaster queued");
  }

  const consequence = live
    ? "This episode is published, so if its book is published too, every app user gets the new media on their next fetch."
    : "This episode is a draft, so it stays hidden from the app and stays a draft.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remaster</CardTitle>
        <CardDescription>
          Re-renders every voice from this chapter&apos;s local script and scenes, and swaps the episode&apos;s media in place. Status, title, summary and takeaways stay as they are.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {refusal && (
          <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm" role="alert">
            <p className="font-medium text-destructive">The last remaster refused, and nothing was changed.</p>
            <p className="break-words whitespace-pre-wrap text-destructive">{refusal}</p>
            <p>
              Keep the edits by putting the same text into this chapter&apos;s script, then remaster again. Overwriting{" "}
              <span className="font-medium">discards the edited lines listed above</span>.
            </p>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirming("overwrite")}>
              <TriangleAlert /> Discard the edits and remaster
            </Button>
          </div>
        )}
        {result && (
          <p className="text-sm text-muted-foreground">
            Last remaster finished <Time iso={last?.finishedAt} />: {result.voices.join(", ")}.{" "}
            {result.transcriptLinesChanged > 0 ? `${result.transcriptLinesChanged} transcript line(s) overwritten.` : "No transcript text changed."}
          </p>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming("remaster")}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCcw />} Remaster episode {chapter}
        </Button>
      </CardContent>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirming === "overwrite" ? "Discard the transcript edits and remaster?" : `Remaster episode ${chapter}?`}</DialogTitle>
            <DialogDescription>
              When the job finishes it overwrites the episode&apos;s live media immediately, with no draft step and no undo: the video, thumbnail, transcript timing and every voice. {consequence}
            </DialogDescription>
          </DialogHeader>
          {confirming === "overwrite" && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              This also discards the differing transcript text stored in the catalog and replaces it with the text from the local scenes. Those edits exist nowhere else.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={run}>
              {confirming === "overwrite" ? "Discard edits and overwrite live media" : "Overwrite live media"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
