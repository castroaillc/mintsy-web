"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { StringListEditor } from "@/components/string-list-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { callApi } from "@/lib/client-api";
import { scenesJsonSchema, scriptJsonSchema } from "@/lib/schemas";
import type { ContentStatus } from "@/lib/types";

const pretty = (v: unknown) => JSON.stringify(v ?? null, null, 2);

type Parsed = { ok: true; value: unknown } | { ok: false; error: string };

function parse(text: string, schema: typeof scriptJsonSchema | typeof scenesJsonSchema): Parsed {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = schema.safeParse(value);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: `${i?.path.join(".") || "root"}: ${i?.message}` };
  }
  return { ok: true, value };
}

type ScriptFields = { title: string; summary: string; takeaways: string[]; narration: string[] };

export function ScriptEditor({
  bookId,
  chapter,
  script,
  scenes,
  episodeStatus,
  laterLive,
  busy,
}: {
  bookId: string;
  chapter: number;
  script: unknown;
  scenes: unknown;
  episodeStatus: ContentStatus | null;
  laterLive: boolean;
  busy: boolean;
}) {
  const router = useRouter();
  const originalScript = useMemo(() => pretty(script), [script]);
  const originalScenes = useMemo(() => pretty(scenes), [scenes]);
  const [scriptText, setScriptText] = useState(originalScript);
  const [scenesText, setScenesText] = useState(originalScenes);
  const [submitting, setSubmitting] = useState(false);

  const scriptParsed = parse(scriptText, scriptJsonSchema);
  const scenesParsed = parse(scenesText, scenesJsonSchema);
  const scenesEdited = scenesParsed.ok && JSON.stringify(scenesParsed.value) !== JSON.stringify(scenes);
  const scriptEdited = scriptParsed.ok && JSON.stringify(scriptParsed.value) !== JSON.stringify(script);

  const fields: ScriptFields | null = scriptParsed.ok
    ? (() => {
        const o = scriptParsed.value as Record<string, unknown>;
        return {
          title: String(o.title ?? ""),
          summary: String(o.summary ?? ""),
          takeaways: Array.isArray(o.takeaways) ? o.takeaways.map(String) : [],
          narration: Array.isArray(o.narration) ? o.narration.map(String) : [],
        };
      })()
    : null;

  /** Structured edits are written back into script.json, keeping any other keys as they were. */
  function setField<K extends keyof ScriptFields>(k: K, v: ScriptFields[K]) {
    if (!scriptParsed.ok) return;
    setScriptText(pretty({ ...(scriptParsed.value as object), [k]: v }));
  }

  async function render() {
    if (!scriptParsed.ok || !scenesParsed.ok) return;
    const warn =
      episodeStatus === "published"
        ? `\n\nEpisode ${chapter} is live. Rendering returns it to draft${laterLive ? ", which also hides every later episode from the app" : ""} until you publish it again.`
        : "";
    if (!confirm(`Queue a render for chapter ${chapter}? The episode's title, summary and takeaways will be set from this script.${warn}`)) return;
    setSubmitting(true);
    const res = await callApi(`/api/books/${bookId}/jobs`, {
      method: "POST",
      body: {
        kind: "render",
        chapter,
        scriptJson: scriptParsed.value,
        // Only when edited: sending scenes makes the studio skip re-planning them.
        ...(scenesEdited ? { scenesJson: scenesParsed.value } : {}),
      },
    });
    setSubmitting(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Render queued for chapter ${chapter}`);
    router.push(`/books/${bookId}`);
  }

  const valid = scriptParsed.ok && scenesParsed.ok;

  return (
    <div className="space-y-4">
      {episodeStatus === "published" && (
        <Alert className="border-brand/40 bg-brand/10">
          <TriangleAlert className="text-brand" />
          <AlertTitle>Episode {chapter} is live</AlertTitle>
          <AlertDescription>
            A render returns it to draft{laterLive && " and hides every later episode from the app"} until you publish it again.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="fields">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="script">
              script.json {!scriptParsed.ok && <span className="text-destructive">•</span>}
            </TabsTrigger>
            <TabsTrigger value="scenes">
              scenes.json {!scenesParsed.ok && <span className="text-destructive">•</span>}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {scriptEdited || scenesEdited
                ? `Edited: ${[scriptEdited && "script", scenesEdited && "scenes"].filter(Boolean).join(" + ")}`
                : "Unedited"}
            </span>
            {(scriptEdited || scenesEdited) && (
              <Button variant="ghost" size="sm" onClick={() => (setScriptText(originalScript), setScenesText(originalScenes))}>
                Discard edits
              </Button>
            )}
            <Button onClick={render} disabled={!valid || submitting || busy}>
              {submitting ? <Loader2 className="animate-spin" /> : <Clapperboard />}
              Render
            </Button>
          </div>
        </div>
        {busy && <p className="mt-2 text-xs text-muted-foreground">This chapter has a queued or running job. Render is available when it finishes.</p>}

        <TabsContent value="fields" className="mt-4">
          <Card>
            <CardContent>
              {fields ? (
                <div className="space-y-5">
                  <Field id="s-title" label="Title">
                    <Input id="s-title" value={fields.title} onChange={(e) => setField("title", e.target.value)} />
                  </Field>
                  <Field id="s-summary" label="Summary">
                    <Textarea id="s-summary" rows={2} value={fields.summary} onChange={(e) => setField("summary", e.target.value)} />
                  </Field>
                  <Field id="s-takeaways" label="Takeaways">
                    <StringListEditor id="s-takeaways" items={fields.takeaways} onChange={(v) => setField("takeaways", v)} addLabel="Add takeaway" />
                  </Field>
                  <Field
                    id="s-narration"
                    label="Narration"
                    hint="Changing narration re-plans the scenes (one Claude call) and re-voices the episode, unless you also edit scenes.json."
                  >
                    <StringListEditor
                      id="s-narration"
                      items={fields.narration}
                      onChange={(v) => setField("narration", v)}
                      multiline
                      addLabel="Add paragraph"
                    />
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-destructive">script.json doesn&apos;t parse: fix it in the script.json tab first. ({!scriptParsed.ok && scriptParsed.error})</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="script" className="mt-4">
          <JsonEditor id="script-json" value={scriptText} onChange={setScriptText} parsed={scriptParsed} />
        </TabsContent>
        <TabsContent value="scenes" className="mt-4">
          <JsonEditor id="scenes-json" value={scenesText} onChange={setScenesText} parsed={scenesParsed} />
          <p className="mt-2 text-xs text-muted-foreground">
            scenes.json is sent with the render only if you change it. Its narration must match script.json&apos;s.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JsonEditor({ id, value, onChange, parsed }: { id: string; value: string; onChange: (v: string) => void; parsed: Parsed }) {
  return (
    <div className="space-y-2">
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-invalid={!parsed.ok}
        className="h-[60vh] font-mono text-xs leading-relaxed"
      />
      {parsed.ok ? (
        <p className="text-xs text-success">Valid</p>
      ) : (
        <p className="text-xs text-destructive">{parsed.error}</p>
      )}
    </div>
  );
}
