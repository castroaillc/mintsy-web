import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

/**
 * Read-only access to the studio worker's output folder (apps/studio/work/<book>/ep-NN), so the
 * dashboard can preview a render before it's uploaded. Same machine as the worker, like UPLOAD_DIR.
 * Layout is owned by studio (pipeline/paths.ts, pipeline/steps/voice.ts).
 */

export function episodeDir(bookId: string, chapter: number) {
  return path.join(env.studioWorkDir, bookId, `ep-${String(chapter).padStart(2, "0")}`);
}

/** Files the preview route may serve, relative to the episode folder. */
const SERVABLE =
  /^(episode\.mp4|thumbnail\.jpg|renders\/kokoro-[a-z]{2}_[a-z0-9]+\/episode\.mp4|clips\/(?:[a-z]{2}_[a-z0-9]+|voice)-s\d{2}-s\d{2}\.(?:mp4|jpg)|audio\/(kokoro-[a-z]{2}_[a-z0-9]+\/)?\d{2}\.mp3)$/;

/** clips/<voice>-sNN-sNN.mp4. Skips the worker's temporary <name>.render.mp4. */
const CLIP_FILE = /^((?:[a-z]{2}_[a-z0-9]+|voice))-s(\d{2})-s(\d{2})\.mp4$/;

export function previewFilePath(bookId: string, chapter: number, rel: string) {
  return SERVABLE.test(rel) ? path.join(episodeDir(bookId, chapter), rel) : null;
}

export type PreviewVideo = { version: number; sizeMb: number; renderedAt: string };

export type PreviewVoice = {
  id: string;
  voice: string;
  provider: string;
  durationSec: number;
  isDefault: boolean;
  /** Path of this voice's render inside the episode folder, and its file. Null until it's rendered. */
  videoPath: string | null;
  video: PreviewVideo | null;
  clips: { audio: string; audioSec: number }[];
  /** audioSec of every scene in order, for clip lengths. `clips` above leaves out files it can't serve. */
  sceneAudioSec: number[];
};

export type VerticalClip = {
  name: string;
  videoPath: string;
  thumbnailPath: string | null;
  voice: string;
  startScene: number;
  endScene: number;
  version: number;
  sizeMb: number;
  renderedAt: string;
};

export type LocalPreview = {
  video: PreviewVideo | null;
  thumbnail: boolean;
  voices: PreviewVoice[];
  /** Rendered 9:16 clips, in name order. */
  verticalClips: VerticalClip[];
};

function toPreviewVideo(s: { mtimeMs: number; size: number; mtime: Date }): PreviewVideo {
  return { version: Math.round(s.mtimeMs), sizeMb: Math.round((s.size / 1024 / 1024) * 10) / 10, renderedAt: s.mtime.toISOString() };
}

/** The default voice stays at the top of the episode folder; the others are in renders/<track id>/. */
async function voiceVideo(bookId: string, chapter: number, trackId: string, isDefault: boolean) {
  const videoPath = isDefault ? "episode.mp4" : `renders/${trackId}/episode.mp4`;
  const file = previewFilePath(bookId, chapter, videoPath);
  const s = file ? await statOrNull(file) : null;
  return s ? { videoPath, video: toPreviewVideo(s) } : { videoPath: null, video: null };
}

async function listVerticalClips(bookId: string, chapter: number): Promise<VerticalClip[]> {
  const dir = path.join(episodeDir(bookId, chapter), "clips");
  const names = await readdir(dir).catch(() => [] as string[]);
  const clips = await Promise.all(
    names.sort().map(async (file): Promise<VerticalClip | null> => {
      const m = file.match(CLIP_FILE);
      const s = m ? await statOrNull(path.join(dir, file)) : null;
      if (!m || !s) return null;
      const name = file.slice(0, -".mp4".length);
      const thumb = await statOrNull(path.join(dir, `${name}.jpg`));
      return {
        name,
        videoPath: `clips/${file}`,
        thumbnailPath: thumb ? `clips/${name}.jpg` : null,
        voice: m[1],
        startScene: Number(m[2]),
        endScene: Number(m[3]),
        ...toPreviewVideo(s),
      };
    }),
  );
  return clips.filter((c) => c !== null);
}

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

/** script.json and scenes.json when both exist, with the time the later one was written. */
export async function getScriptFiles(bookId: string, chapter: number) {
  const dir = episodeDir(bookId, chapter);
  const [script, scenes] = await Promise.all([statOrNull(path.join(dir, "script.json")), statOrNull(path.join(dir, "scenes.json"))]);
  if (!script || !scenes) return null;
  return { newestMs: Math.round(Math.max(script.mtimeMs, scenes.mtimeMs)) };
}

export async function hasScriptJson(bookId: string, chapter: number) {
  return !!(await statOrNull(path.join(episodeDir(bookId, chapter), "script.json")));
}

/** Pages per chapter from work/<book>/book.json (written by ingest), or null when it isn't there. */
export async function getChapterPages(bookId: string) {
  const book = await readJson<{ chapters?: { number: number; startPage: number; endPage: number }[] }>(path.join(env.studioWorkDir, bookId, "book.json"));
  return book?.chapters ? new Map(book.chapters.map((c) => [c.number, c.endPage - c.startPage + 1])) : null;
}

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
      const isDefault = v.id === index.default;
      voices.push({
        id: v.id,
        voice: v.voice,
        provider: v.provider,
        durationSec: v.durationSec,
        isDefault,
        ...(await voiceVideo(bookId, chapter, v.id, isDefault)),
        clips: track.scenes.map((s) => ({ audio: s.audio, audioSec: s.audioSec })),
        sceneAudioSec: track.scenes.map((s) => s.audioSec),
      });
    }
  } else {
    // Older episodes have a single voice.json and no index.
    const track = await readJson<VoiceFile>(path.join(dir, "voice.json"));
    if (track)
      voices.push({
        id: "voice",
        voice: "Original narration",
        provider: "legacy",
        durationSec: track.durationSec,
        isDefault: true,
        ...(await voiceVideo(bookId, chapter, "voice", true)),
        clips: track.scenes.map((s) => ({ audio: s.audio, audioSec: s.audioSec })),
        sceneAudioSec: track.scenes.map((s) => s.audioSec),
      });
  }

  return {
    video: video ? toPreviewVideo(video) : null,
    thumbnail: !!thumb,
    voices: voices.map((v) => ({ ...v, clips: v.clips.filter((c) => previewFilePath(bookId, chapter, c.audio)) })),
    verticalClips: await listVerticalClips(bookId, chapter),
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
