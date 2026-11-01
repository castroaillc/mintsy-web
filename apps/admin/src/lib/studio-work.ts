import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { readFile } from "node:fs/promises";

/**
 * Read-only access to the studio worker's output folder (studio/work/<book>/ep-NN), so the
 * dashboard can preview a render before it's uploaded. Same machine as the worker, like UPLOAD_DIR.
 * Layout is owned by studio (pipeline/paths.ts, pipeline/steps/voice.ts).
 */

export function episodeDir(bookId: string, chapter: number) {
  return path.join(env.studioWorkDir, bookId, `ep-${String(chapter).padStart(2, "0")}`);
}

/** Files the preview route may serve, relative to the episode folder. */
const SERVABLE = /^(episode\.mp4|thumbnail\.jpg|audio\/(kokoro-[a-z]{2}_[a-z0-9]+\/)?\d{2}\.mp3)$/;

export function previewFilePath(bookId: string, chapter: number, rel: string) {
  return SERVABLE.test(rel) ? path.join(episodeDir(bookId, chapter), rel) : null;
}

export type PreviewVoice = {
  id: string;
  voice: string;
  provider: string;
  durationSec: number;
  isDefault: boolean;
  clips: { audio: string; audioSec: number }[];
};

export type LocalPreview = {
  video: { version: number; sizeMb: number; renderedAt: string } | null;
  thumbnail: boolean;
  voices: PreviewVoice[];
};

async function statOrNull(p: string) {
  try {
    return await stat(p);
  } catch {
    return null;
  }
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

type VoiceFile = { scenes: { audio: string; audioSec: number }[]; durationSec: number };
type VoiceIndex = { default: string; voices: { id: string; provider: string; voice: string; durationSec: number; file: string }[] };

export async function getLocalPreview(bookId: string, chapter: number): Promise<LocalPreview> {
  const dir = episodeDir(bookId, chapter);
  const [video, thumb] = await Promise.all([statOrNull(path.join(dir, "episode.mp4")), statOrNull(path.join(dir, "thumbnail.jpg"))]);

  const voices: PreviewVoice[] = [];
  const index = await readJson<VoiceIndex>(path.join(dir, "voices/index.json"));
  if (index) {
    for (const v of index.voices) {
      if (!/^voices\/[\w-]+\.json$/.test(v.file)) continue;
      const track = await readJson<VoiceFile>(path.join(dir, v.file));
      if (!track) continue;
      voices.push({
        id: v.id,
        voice: v.voice,
        provider: v.provider,
        durationSec: v.durationSec,
        isDefault: v.id === index.default,
        clips: track.scenes.map((s) => ({ audio: s.audio, audioSec: s.audioSec })),
      });
    }
  } else {
    // ElevenLabs episodes have a single voice.json and no index.
    const track = await readJson<VoiceFile>(path.join(dir, "voice.json"));
    if (track)
      voices.push({
        id: "voice",
        voice: "ElevenLabs",
        provider: "elevenlabs",
        durationSec: track.durationSec,
        isDefault: true,
        clips: track.scenes.map((s) => ({ audio: s.audio, audioSec: s.audioSec })),
      });
  }

  return {
    video: video ? { version: Math.round(video.mtimeMs), sizeMb: Math.round((video.size / 1024 / 1024) * 10) / 10, renderedAt: video.mtime.toISOString() } : null,
    thumbnail: !!thumb,
    voices: voices.map((v) => ({ ...v, clips: v.clips.filter((c) => previewFilePath(bookId, chapter, c.audio)) })),
  };
}

/** work/<book>/cover.jpg, rendered by the studio worker (after ingest, or by a cover job). */
export function coverPath(bookId: string) {
  return path.join(env.studioWorkDir, bookId, "cover.jpg");
}

export async function getLocalCover(bookId: string) {
  const s = await statOrNull(coverPath(bookId));
  return s ? { version: Math.round(s.mtimeMs), renderedAt: s.mtime.toISOString() } : null;
}
