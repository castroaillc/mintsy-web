"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Plus, Save, TriangleAlert, Upload, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { StringListEditor } from "@/components/string-list-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { callApi } from "@/lib/client-api";
import { episodeEditSchema } from "@/lib/schemas";
import type { RuleCheck } from "@/lib/status";
import type { ContentStatus, TranscriptLine } from "@/lib/types";

type Values = { title: string; summary: string; takeaways: string[]; transcript: TranscriptLine[] };
type Errors = Record<string, string>;

export function EpisodeEditor({
  bookId,
  number,
  durationSec,
  baseUpdatedAt,
  status,
  rule,
  videoUrl,
  thumbnailUrl,
  videoPath,
  voices,
  initial,
}: {
  bookId: string;
  number: number;
  durationSec: number;
  /** The episode's stored updatedAt when this form loaded; the save route refuses if it has moved on. */
  baseUpdatedAt: string | null;
  status: ContentStatus;
  rule: RuleCheck;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  videoPath: string | null;
  /** Null on an episode without voices. */
  voices: { count: number; defaultName: string | null; lineCount: number } | null;
  initial: Values;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const published = status === "published";

  function validate() {
    const r = episodeEditSchema({ durationSec, storedTranscript: initial.transcript, voiceLineCount: voices?.lineCount ?? null }).safeParse(v);
    if (r.success) {
      setErrors({});
      return r.data;
    }
    const errs: Errors = {};
    for (const i of r.error.issues) errs[i.path.join(".")] ??= i.message;
    setErrors(errs);
    return null;
  }

  async function save() {
    const data = validate();
    if (!data) return void toast.error("Fix the highlighted fields");
    if (published && !confirm("This episode is live. Saving changes the app immediately. Continue?")) return;
    setSaving(true);
    const res = await callApi(`/api/books/${bookId}/episodes/${number}`, { method: "PATCH", body: { ...data, baseUpdatedAt } });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Episode saved");
    router.refresh();
  }

  async function toggle() {
    const target = published ? "draft" : "published";
    if (target === "published" && !confirm(`Publish episode ${number}? It goes live in the app immediately (if the book is published).`)) return;
    setToggling(true);
    const res = await callApi(`/api/books/${bookId}/episodes/${number}/status`, { method: "POST", body: { status: target } });
    setToggling(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(target === "published" ? `Episode ${number} published` : `Episode ${number} unpublished`);
    router.refresh();
  }

  const setLine = (i: number, patch: Partial<TranscriptLine>) =>
    setV((s) => ({ ...s, transcript: s.transcript.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const hasFractional = v.transcript.some((l) => Number.isFinite(l.startSec) && !Number.isInteger(l.startSec));
  const roundTimes = () =>
    setV((s) => ({
      ...s,
      transcript: s.transcript.map((l) => (Number.isFinite(l.startSec) ? { ...l, startSec: Math.min(Math.round(l.startSec), Math.max(Math.ceil(durationSec) - 1, 0)) } : l)),
    }));

  const toggleBlocked = !rule.ok ? rule.reason : dirty ? "Save or discard your edits first." : null;
  const takeawayErrors = Object.fromEntries(
    Object.entries(errors)
      .filter(([k]) => k.startsWith("takeaways."))
      .map(([k, m]) => [Number(k.split(".")[1]), m]),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Text</CardTitle>
            <CardDescription>Shown on the episode page in the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field id="title" label="Title" error={errors.title}>
              <Input id="title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} aria-invalid={!!errors.title} />
            </Field>
            <Field id="summary" label="Summary" error={errors.summary}>
              <Textarea id="summary" rows={3} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} aria-invalid={!!errors.summary} />
            </Field>
            <Field id="takeaways" label="Takeaways" error={errors.takeaways}>
              <StringListEditor
                id="takeaways"
                items={v.takeaways}
                onChange={(takeaways) => setV({ ...v, takeaways })}
                addLabel="Add takeaway"
                errors={takeawayErrors}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>
              Start times in whole seconds, ascending, each under the episode length ({durationSec}s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {voices && (
              <Alert className="border-brand/40 bg-brand/10 text-foreground">
                <TriangleAlert className="text-brand" />
                <AlertDescription>
                  Edits here only affect the default voice&apos;s transcript{voices.defaultName && ` (${voices.defaultName})`}. They don&apos;t change the other{" "}
                  {voices.count > 1 ? `${voices.count - 1} voice${voices.count === 2 ? "" : "s"}` : "voices"} or the timed captions. The number of lines can&apos;t change, because the app
                  converts positions between voices by matching lines.
                </AlertDescription>
              </Alert>
            )}
            {hasFractional && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
                <span className="min-w-48 flex-1">
                  This transcript has fractional start times. Other fields save without touching them, but changing the transcript needs whole seconds.
                </span>
                <Button type="button" size="sm" variant="outline" onClick={roundTimes}>
                  Round to whole seconds
                </Button>
              </div>
            )}
            {errors.transcript && <p className="text-xs text-destructive">{errors.transcript}</p>}
            {v.transcript.map((line, i) => {
              const tErr = errors[`transcript.${i}.startSec`];
              const xErr = errors[`transcript.${i}.text`];
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-24 shrink-0">
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      aria-label={`Line ${i + 1} start (s)`}
                      value={Number.isNaN(line.startSec) ? "" : line.startSec}
                      onChange={(e) => setLine(i, { startSec: e.target.valueAsNumber })}
                      aria-invalid={!!tErr}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="flex-1">
                    <Textarea
                      rows={2}
                      aria-label={`Line ${i + 1} text`}
                      value={line.text}
                      onChange={(e) => setLine(i, { text: e.target.value })}
                      aria-invalid={!!xErr}
                      className="min-h-0"
                    />
                    {(tErr || xErr) && <p className="mt-1 text-xs text-destructive">{tErr ?? xErr}</p>}
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove line"
                    disabled={!!voices}
                    onClick={() => setV({ ...v, transcript: v.transcript.filter((_, j) => j !== i) })}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!voices}
              onClick={() => {
                const last = v.transcript.at(-1)?.startSec ?? -1;
                setV({ ...v, transcript: [...v.transcript, { startSec: Math.min(Math.floor(last) + 1, Math.max(durationSec - 1, 0)), text: "" }] });
              }}
            >
              <Plus /> Add line
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card size="sm">
          <CardContent className="space-y-3">
            {videoUrl ? (
              <video
                src={videoUrl}
                poster={thumbnailUrl ?? undefined}
                controls
                preload="metadata"
                className="max-h-[60vh] w-full rounded-lg bg-black object-contain"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">No video yet</div>
            )}
            {thumbnailUrl && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- bucket image, no optimisation needed locally */}
                <img src={thumbnailUrl} alt="Thumbnail" className="h-16 rounded-md object-cover ring-1 ring-foreground/10" />
                <span className="text-xs text-muted-foreground">Thumbnail</span>
              </div>
            )}
            {videoPath && <p className="break-all font-mono text-[11px] text-faint">{videoPath}</p>}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save} disabled={!dirty || saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
              {dirty && (
                <Button variant="ghost" onClick={() => (setV(initial), setErrors({}))}>
                  <Undo2 /> Discard
                </Button>
              )}
            </div>
            <Button
              className="w-full"
              variant={published ? "destructive" : "outline"}
              onClick={toggle}
              disabled={!!toggleBlocked || toggling}
            >
              {toggling ? <Loader2 className="animate-spin" /> : published ? <Undo2 /> : <Upload />}
              {published ? "Unpublish" : "Publish"}
            </Button>
            {toggleBlocked && <p className="text-xs text-muted-foreground">{toggleBlocked}</p>}
            {!toggleBlocked && !published && <p className="text-xs text-muted-foreground">Goes live in the app immediately.</p>}
          </CardContent>
        </Card>

        <Alert>
          <Info />
          <AlertDescription>
            Uploading a new render replaces the title, summary and takeaways with the values in script.json and the transcript with the render&apos;s, and returns the episode to draft. A
            remaster (chapter page) swaps the media in place, live at once, and keeps the status, title, summary and takeaways. It replaces transcript timing, and it refuses if the
            transcript text here differs from the local script, naming the lines. To keep a text edit through either, make it in the chapter&apos;s script review too.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
