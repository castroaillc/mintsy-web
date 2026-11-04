/**
 * The voices of an episode as the pipeline sees them: which tracks to render, where each one's
 * output goes, and the rules for what's written to `books.episodes[].voices`.
 * The stored shape is owned by the backend (`EpisodeVoiceDoc` in apps/backend/src/catalog.ts), which
 * exposes it as non-null `Int!` and lists and doesn't validate it: a bad value would fail that
 * episode's whole API response, so everything is checked here before it's uploaded or written.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import { phrases } from "../src/collage/phrases";
import { FPS, INTRO_FRAMES, sceneFrames } from "../src/episode/timing";
import { files } from "./paths";
import type { TranscriptLine, Voice, VoiceIndex } from "./steps/voice";
import { kokoroVoices } from "./tts";
import { readJson } from "./util";

/** One timed caption phrase, on its voice's final video timeline. Seconds may be fractional. */
export interface CaptionPhrase {
  startSec: number;
  endSec: number;
  text: string;
}

export interface EpisodeVoiceDoc {
  /** Voice id, e.g. "af_heart". */
  id: string;
  name: string;
  isDefault: boolean;
  videoPath: string;
  hlsPath?: string;
  /** Whole seconds. */
  durationSec: number;
  /** startSec in whole seconds. */
  transcript: TranscriptLine[];
  captions: CaptionPhrase[];
}

/** A voice's stored fields before its media is uploaded. */
export type EpisodeVoiceText = Omit<EpisodeVoiceDoc, "videoPath" | "hlsPath">;

/** One video to render: a voice from voices/index.json, or the only track of an older episode. */
export interface RenderTarget {
  /** Absent for an episode voiced before Kokoro: it has only voice.json, and no voices to store. */
  voice?: { id: string; name: string };
  /** The folder name in renders/ and in progress lines, e.g. "kokoro-am_michael". */
  trackId: string;
  isDefault: boolean;
  /** Holds episode.mp4, hls/ and props.json. The default voice stays at the episode folder's top level. */
  outDir: string;
  track: Voice;
}

/** "af_heart" -> "Heart". */
export const voiceName = (voice: string) => {
  const name = voice.slice(voice.indexOf("_") + 1);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** Every video this episode has, default first. Throws if voices/ is incomplete or doesn't match KOKORO_VOICES. */
export async function renderTargets(epDir: string): Promise<RenderTarget[]> {
  const indexPath = path.join(epDir, "voices/index.json");
  if (!existsSync(indexPath)) {
    if (existsSync(path.join(epDir, "voices"))) {
      throw new Error(`${indexPath} is missing, so the voices are incomplete: rerun with --from voice`);
    }
    if (!existsSync(path.join(epDir, files.voice))) throw new Error(`No voices/index.json or ${files.voice} in ${epDir}: run the voice step`);
    return [{ trackId: "voice", isDefault: true, outDir: epDir, track: await readJson<Voice>(path.join(epDir, files.voice)) }];
  }

  const index = await readJson<VoiceIndex>(indexPath);
  const listed = index.voices.map((v) => v.voice).join(",");
  const wanted = kokoroVoices().join(",");
  if (listed !== wanted) {
    throw new Error(`voices/index.json has ${listed} but KOKORO_VOICES is ${wanted}: rerun with --from voice, or set KOKORO_VOICES to match`);
  }
  if (index.default !== index.voices[0].id) {
    throw new Error(`voices/index.json: the default "${index.default}" isn't the first voice "${index.voices[0].id}"`);
  }
  return Promise.all(
    index.voices.map(async (v, i) => {
      const file = path.join(epDir, v.file);
      if (!existsSync(file)) throw new Error(`${file} is missing, so the voices are incomplete: rerun with --from voice`);
      return {
        voice: { id: v.voice, name: voiceName(v.voice) },
        trackId: v.id,
        isDefault: i === 0,
        outDir: i === 0 ? epDir : path.join(epDir, files.renders, v.id),
        track: await readJson<Voice>(file),
      };
    }),
  );
}

/** Identifies what a render was made from, so an upload can't pair a video with a different track. */
export const trackStamp = (track: Voice) => createHash("sha256").update(JSON.stringify(track)).digest("hex").slice(0, 16);

/**
 * Caption phrases on the voice's final video timeline. Uses the same frame arithmetic as the
 * compositions: the intro, then each scene for sceneFrames(audioSec). Word times are from the start
 * of their scene's clip. Phrases never span two scenes.
 */
export function buildCaptions(scenes: Pick<Voice["scenes"][number], "audioSec" | "words">[]): CaptionPhrase[] {
  const toMs = (sec: number) => Math.round(sec * 1000) / 1000;
  const captions: CaptionPhrase[] = [];
  let startFrame = INTRO_FRAMES;
  for (const scene of scenes) {
    const offsetSec = startFrame / FPS;
    for (const group of phrases(scene.words ?? [])) {
      captions.push({
        startSec: toMs(offsetSec + group[0].startSec),
        endSec: toMs(offsetSec + group[group.length - 1].endSec),
        text: group.map((w) => w.text).join(" "),
      });
    }
    startFrame += sceneFrames(scene.audioSec);
  }
  return captions;
}

/** The API's Int! needs whole seconds. voiceTrack already rounds, but older or hand-edited files might not. */
export const wholeSecondTranscript = (lines: TranscriptLine[]): TranscriptLine[] =>
  lines.map((l) => ({ startSec: Math.round(l.startSec), text: l.text }));

/** A voice's stored fields from its render target. Only for targets that have a voice. */
export function voiceText(target: RenderTarget): EpisodeVoiceText {
  if (!target.voice) throw new Error(`Track "${target.trackId}" has no voice`);
  return {
    id: target.voice.id,
    name: target.voice.name,
    isDefault: target.isDefault,
    durationSec: Math.round(target.track.durationSec),
    transcript: wholeSecondTranscript(target.track.transcript),
    captions: buildCaptions(target.track.scenes),
  };
}

const isWhole = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
const isSec = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const isText = (s: unknown) => typeof s === "string" && s.length > 0;

/** Checks every voice's text and timing, and that the app can convert positions between voices. */
export function checkVoiceText(voices: EpisodeVoiceText[]) {
  if (voices.length === 0) return;
  const problems: string[] = [];
  for (const v of voices) {
    const at = `voice "${v.id}"`;
    if (!isText(v.id) || !isText(v.name)) problems.push(`${at}: needs an id and a name`);
    if (!isWhole(v.durationSec) || v.durationSec === 0) problems.push(`${at}: durationSec ${v.durationSec} isn't a positive whole number`);
    if (!Array.isArray(v.transcript)) problems.push(`${at}: transcript isn't a list`);
    else if (v.transcript.some((l) => !isWhole(l.startSec) || typeof l.text !== "string")) problems.push(`${at}: a transcript line needs a whole startSec and text`);
    if (!Array.isArray(v.captions)) problems.push(`${at}: captions isn't a list`);
    else if (v.captions.some((c) => !isSec(c.startSec) || !isSec(c.endSec) || c.endSec < c.startSec || !isText(c.text))) problems.push(`${at}: a caption needs valid times and text`);
  }
  if (voices.filter((v) => v.isDefault).length !== 1) problems.push("exactly one voice must be the default");
  else if (!voices[0].isDefault) problems.push(`the default must be the first voice, not "${voices.find((v) => v.isDefault)?.id}"`);
  if (new Set(voices.map((v) => v.id)).size !== voices.length) problems.push("voice ids must be different");
  const counts = voices.map((v) => (Array.isArray(v.transcript) ? v.transcript.length : -1));
  if (new Set(counts).size > 1) {
    problems.push(`voices have different transcript line counts (${voices.map((v, i) => `${v.id}: ${counts[i]}`).join(", ")}), and the app converts positions between voices by matching lines`);
  }
  if (problems.length > 0) throw new Error(`Episode voices are invalid: ${problems.join("; ")}`);
}

type EpisodeTop = { durationSec: number; transcript: TranscriptLine[]; videoPath?: string; hlsPath?: string; voices?: EpisodeVoiceDoc[] };

/** The last check before anything is written to `books`: the voices, and the default matching the top-level fields App Store builds read. */
export function checkEpisodeVoices(episode: EpisodeTop) {
  const problems: string[] = [];
  if (!isWhole(episode.durationSec)) problems.push(`top-level durationSec ${episode.durationSec} isn't a whole number`);
  if (!Array.isArray(episode.transcript) || episode.transcript.some((l) => !isWhole(l.startSec))) problems.push("a top-level transcript line needs a whole startSec");
  const voices = episode.voices;
  if (!Array.isArray(voices)) problems.push("voices must be a list, even when empty");
  else if (voices.length > 0) {
    checkVoiceText(voices);
    for (const v of voices) if (!isText(v.videoPath)) problems.push(`voice "${v.id}": needs a videoPath`);
    if (new Set(voices.map((v) => v.videoPath)).size !== voices.length) problems.push("voices must have different videoPaths");
    const main = voices[0];
    if (main.videoPath !== episode.videoPath) problems.push("the default voice's videoPath differs from the episode's");
    if (main.hlsPath !== episode.hlsPath) problems.push("the default voice's hlsPath differs from the episode's");
    if (main.durationSec !== episode.durationSec) problems.push("the default voice's durationSec differs from the episode's");
    if (JSON.stringify(main.transcript) !== JSON.stringify(episode.transcript)) problems.push("the default voice's transcript differs from the episode's");
  }
  if (problems.length > 0) throw new Error(`Episode voices are invalid: ${problems.join("; ")}`);
}
