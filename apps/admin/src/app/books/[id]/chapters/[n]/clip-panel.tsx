"use client";

import { useState } from "react";
import { Download, Film, Loader2, TriangleAlert } from "lucide-react";
import { Time } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLIP_MAX_SCENES, END_CARD_SEC, planClip, sceneSec } from "@/lib/clips";
import type { PreviewVoice, VerticalClip } from "@/lib/studio-work";
import type { ClipJobResult, JobView } from "@/lib/types";
import { voiceLabel } from "./local-preview";

const AUTO = "auto";

const NOT_LIVE = "This episode wasn't published when the clip was rendered, so its viewers couldn't watch it in the app. Publish the episode before posting.";

/** The form for a clip job, and the clips already in studio's work folder. Posting them is manual. */
export function ClipPanel({
  base,
  bookId,
  chapter,
  voices,
  clips,
  jobs,
  busy,
  queue,
}: {
  /** The preview route for this chapter. */
  base: string;
  bookId: string;
  chapter: number;
  voices: PreviewVoice[];
  clips: VerticalClip[];
  jobs: JobView[];
  busy: boolean;
  queue: (body: Record<string, unknown>, done: string) => Promise<void>;
}) {
  const [voiceId, setVoiceId] = useState(() => (voices.find((v) => v.isDefault) ?? voices[0])?.id ?? "");
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(AUTO);
  const voice = voices.find((v) => v.id === voiceId);
  const audioSecs = voice?.sceneAudioSec ?? [];
  const plan = voice && audioSecs.length ? planClip(audioSecs, start, end === AUTO ? undefined : Number(end)) : null;

  const clipJobs = jobs.filter((j) => j.kind === "clip");
  const last = clipJobs[0];
  const results = new Map<string, ClipJobResult>();
  for (const j of clipJobs) {
    const r = j.status === "succeeded" ? (j.result as ClipJobResult | undefined) : undefined;
    if (r && !results.has(r.videoPath)) results.set(r.videoPath, r);
  }
  const lastResult = last?.status === "succeeded" ? (last.result as ClipJobResult | undefined) : undefined;

  function queueClip() {
    return queue(
      {
        kind: "clip",
        // An episode voiced before Kokoro has a single track, and studio only takes it with no voice.
        ...(voice && voice.provider !== "legacy" ? { voice: voice.voice } : {}),
        startScene: start,
        ...(end === AUTO ? {} : { endScene: Number(end) }),
      },
      "Clip queued",
    );
  }

  if (voices.length === 0 && clips.length === 0) return null;
  const endChoices = Array.from({ length: Math.min(CLIP_MAX_SCENES, audioSecs.length - start + 1) }, (_, i) => start + i);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vertical clips</CardTitle>
        <CardDescription>9:16 clips for social posts, rendered on this machine. Nothing is uploaded, and posting them is manual.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {voices.length > 0 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="clip-voice">Voice</Label>
                <Select
                  value={voiceId}
                  onValueChange={(id) => {
                    setVoiceId(id);
                  }}
                >
                  <SelectTrigger id="clip-voice" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {voiceLabel(v)}
                        {v.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clip-start">First scene</Label>
                <Select
                  value={String(start)}
                  onValueChange={(s) => {
                    setStart(Number(s));
                    setEnd(AUTO);
                  }}
                >
                  <SelectTrigger id="clip-start" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audioSecs.map((a, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        Scene {i + 1} · {sceneSec(a).toFixed(1)} s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clip-end">Last scene</Label>
                <Select value={end} onValueChange={setEnd}>
                  <SelectTrigger id="clip-end" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO}>Automatic</SelectItem>
                    {endChoices.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Scene {n} · {sceneSec(audioSecs[n - 1]).toFixed(1)} s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {plan && (
              <p className="text-sm text-muted-foreground" data-clip-plan>
                Scenes {plan.start} to {plan.end}: {plan.scenesSec.toFixed(1)} s, so about {plan.finishedSec.toFixed(1)} s finished with the {END_CARD_SEC} s end card.
              </p>
            )}
            {plan?.problem && <p className="text-sm text-destructive">{plan.problem}</p>}

            <Button size="sm" disabled={busy || !plan || !!plan.problem} onClick={queueClip}>
              {busy ? <Loader2 className="animate-spin" /> : <Film />} Render clip
            </Button>
          </div>
        )}

        {last?.status === "failed" && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm break-words text-destructive" role="alert">
            {last.error ?? "The clip job failed with no error message."}
          </p>
        )}
        {lastResult?.episodePublished === false && <NotLiveWarning />}

        {clips.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,240px))] gap-4">
            {clips.map((c) => {
              const result = results.get(c.videoPath);
              const track = voices.find((v) => v.voice === c.voice || v.id === c.voice);
              const seconds = result?.durationSec ?? (track ? planClip(track.sceneAudioSec, c.startScene, c.endScene).finishedSec : null);
              return (
                <div key={c.name} className="space-y-2">
                  <video
                    key={c.version}
                    src={`${base}/${c.videoPath}?v=${c.version}`}
                    poster={c.thumbnailPath ? `${base}/${c.thumbnailPath}?v=${c.version}` : undefined}
                    controls
                    preload="metadata"
                    aria-label={`Clip ${c.name}`}
                    className="aspect-[9/16] w-full rounded-lg bg-black object-contain"
                  />
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">{track ? voiceLabel(track) : c.voice}</div>
                    <div>
                      Scenes {c.startScene} to {c.endScene}
                      {seconds != null && ` · ${seconds.toFixed(1)} s`} · {c.sizeMb} MB
                    </div>
                    <div>
                      Rendered <Time iso={c.renderedAt} />
                    </div>
                  </div>
                  {result?.episodePublished === false && <NotLiveWarning compact />}
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <a href={`${base}/${c.videoPath}?v=${c.version}`} download={`${bookId}-ep${String(chapter).padStart(2, "0")}-${c.name}.mp4`}>
                      <Download /> Download
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotLiveWarning({ compact }: { compact?: boolean }) {
  return (
    <p className="flex gap-2 rounded-lg border border-brand/40 bg-brand/10 p-3 text-sm text-foreground" role="alert">
      <TriangleAlert className="size-4 shrink-0 text-brand" />
      {compact ? "Episode wasn't published when this was rendered." : NOT_LIVE}
    </p>
  );
}
