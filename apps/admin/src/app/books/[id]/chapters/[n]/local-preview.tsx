"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Time, formatDuration } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LocalPreview as Preview, PreviewVoice } from "@/lib/studio-work";
import { cn } from "@/lib/utils";

const VOICE_LABEL: Record<string, string> = {
  af_heart: "Heart · US, female",
  am_michael: "Michael · US, male",
  bm_george: "George · UK, male",
};

export const voiceLabel = (v: PreviewVoice) => (v.provider === "legacy" ? v.voice : (VOICE_LABEL[v.voice] ?? v.voice));

export function LocalPreview({ bookId, chapter, preview }: { bookId: string; chapter: number; preview: Preview }) {
  const base = `/api/books/${bookId}/chapters/${chapter}/preview`;
  if (!preview.video && preview.voices.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Local preview</CardTitle>
        <CardDescription>
          Straight from studio&apos;s work folder on this machine, before anything is uploaded. A preview renders one video per voice, so it takes about three times as long as a single video.
          {preview.video && (
            <>
              {" "}
              Rendered <Time iso={preview.video.renderedAt} /> · {preview.video.sizeMb} MB
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {preview.voices.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {preview.voices.map((v) => (
              <div key={v.id} className="space-y-1.5">
                {v.video && v.videoPath ? (
                  <video
                    key={v.video.version}
                    src={`${base}/${v.videoPath}?v=${v.video.version}`}
                    poster={v.isDefault && preview.thumbnail ? `${base}/thumbnail.jpg?v=${v.video.version}` : undefined}
                    controls
                    preload="metadata"
                    aria-label={`Episode narrated by ${voiceLabel(v)}`}
                    className="aspect-video w-full rounded-lg bg-black"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">Not rendered yet</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {voiceLabel(v)}
                  {v.isDefault && preview.voices.length > 1 && <span className="ml-2 text-brand">default</span>}
                  {v.video && ` · ${v.video.sizeMb} MB`}
                </p>
              </div>
            ))}
          </div>
        ) : preview.video ? (
          <video
            key={preview.video.version}
            src={`${base}/episode.mp4?v=${preview.video.version}`}
            poster={preview.thumbnail ? `${base}/thumbnail.jpg?v=${preview.video.version}` : undefined}
            controls
            preload="metadata"
            className="aspect-video w-full rounded-lg bg-black"
          />
        ) : null}

        {preview.voices.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Narration by scene (audio only)</h3>
            <div className="divide-y rounded-lg border">
              {preview.voices.map((v) => (
                <VoicePlayer key={v.id} base={base} voice={v} version={preview.video?.version ?? 0} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Plays a voice's scene clips back to back, like the narration in the video (without the intro). */
function VoicePlayer({ base, voice, version }: { base: string; voice: PreviewVoice; version: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const clips = voice.clips;

  function load(i: number, autoplay: boolean) {
    const el = audio.current;
    if (!el || !clips[i]) return;
    setScene(i);
    setStarted(true);
    el.src = `${base}/${clips[i].audio}?v=${version}`;
    if (autoplay) void el.play();
  }

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (!started) return load(scene, true);
    if (el.paused) void el.play();
    else el.pause();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <Button size="icon" variant={playing ? "default" : "outline"} className="size-8" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <div className="min-w-40 flex-1">
        <div className="text-sm font-medium">
          {voiceLabel(voice)}
          {voice.isDefault && <span className="ml-2 text-xs font-normal text-brand">default</span>}
        </div>
        <div className="font-mono text-xs text-faint">
          {voice.id} · {formatDuration(voice.durationSec * 1000)}
        </div>
      </div>
      <div className="flex flex-wrap gap-1" aria-label="Scenes">
        {clips.map((c, i) => (
          <button
            key={c.audio}
            type="button"
            title={`Scene ${i + 1} · ${c.audioSec.toFixed(1)}s`}
            onClick={() => load(i, true)}
            className={cn(
              "size-6 rounded text-[10px] tabular-nums transition-colors",
              i === scene && started ? "bg-brand text-background" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => (scene + 1 < clips.length ? load(scene + 1, true) : setPlaying(false))}
      />
    </div>
  );
}
