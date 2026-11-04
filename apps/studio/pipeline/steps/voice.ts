import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { CollageScene } from "../../src/collage/schema";
import type { Scene } from "../../src/episode/schema";
import { cuePhrases } from "../cues";
import { FPS, INTRO_SEC, sceneFrames } from "../../src/episode/timing";
import { files } from "../paths";
import { type Alignment, KokoroTts, kokoroSpeed, kokoroVoices } from "../tts";
import { mediaDurationSec, normalize, readJson, writeJson } from "../util";

type CachedClip = { hash: string; alignment: Alignment };

export type TranscriptLine = { startSec: number; text: string };
/** One spoken word, in seconds from the start of its scene's clip. */
export type SpokenWord = { text: string; startSec: number; endSec: number };
/** Either scene format, with its narration clip and the time each cue phrase is spoken. */
export type TimedAnyScene = (Scene | CollageScene) & {
  audio: string;
  audioSec: number;
  cueSec: Record<string, number>;
  /** Every word with its timing (for word-synced captions); additive, older voice.json files lack it. */
  words: SpokenWord[];
};
export type Voice = { scenes: TimedAnyScene[]; transcript: TranscriptLine[]; durationSec: number };
/**
 * voices/index.json: every narration track of the episode. Each is rendered to its own video.
 * Episodes voiced before Kokoro have none: only voice.json, pointing at flat audio/NN.mp3 clips.
 */
export type VoiceIndex = {
  default: string;
  voices: { id: string; provider: "kokoro"; voice: string; durationSec: number; file: string }[];
};

/** One transcript line per sentence of a scene's narration. Normalized text in, trimmed lines out. */
export const transcriptSentences = (text: string) => (text.match(/[^.!?]+[.!?]+["')\]]*/g) ?? [text]).map((sentence) => sentence.trim());

/** Words of the spoken text with their start/end times, from the character alignment. */
function wordsFromAlignment(alignment: Alignment): SpokenWord[] {
  const spoken = alignment.characters.join("");
  return [...spoken.matchAll(/\S+/g)].map((m) => ({
    text: m[0],
    startSec: Math.round(alignment.character_start_times_seconds[m.index] * 1000) / 1000,
    endSec: Math.round(alignment.character_end_times_seconds[m.index + m[0].length - 1] * 1000) / 1000,
  }));
}

/** Seconds at which `phrase` starts in the spoken text, or undefined if it can't be found. */
function phraseStart(alignment: Alignment, phrase: string) {
  const spoken = alignment.characters.join("").toLowerCase();
  const index = spoken.indexOf(phrase.toLowerCase().trim());
  return index >= 0 ? alignment.character_start_times_seconds[index] : undefined;
}

/** Narrates one scene into the given mp3 and returns its character timings. */
type Synth = (text: string, mp3: string) => Promise<Alignment>;

/**
 * Voices every scene with `synth` into `<audioDir>/NN.mp3` (cached by `cacheKey` + text) and
 * returns the timed track. `label` is appended to progress lines when several voices are made.
 */
async function voiceTrack(
  epDir: string,
  scenes: (Scene | CollageScene)[],
  audioDir: string,
  cacheKey: string,
  synth: Synth,
  label = "",
): Promise<Voice> {
  await mkdir(path.join(epDir, audioDir), { recursive: true });
  const timed: TimedAnyScene[] = [];
  const transcript: TranscriptLine[] = [];
  // The logo intro plays before the first scene
  let offsetSec = INTRO_SEC;

  for (const [i, scene] of scenes.entries()) {
    const text = normalize(scene.narration);
    const name = `${audioDir}/${String(i + 1).padStart(2, "0")}`;
    const mp3 = path.join(epDir, `${name}.mp3`);
    const cachePath = path.join(epDir, `${name}.json`);
    // Re-synthesize only when the text, voice or speed changed
    const hash = createHash("sha256").update(`${cacheKey}|${text}`).digest("hex").slice(0, 16);

    let alignment: Alignment;
    const cached = existsSync(cachePath) && existsSync(mp3) ? await readJson<CachedClip>(cachePath) : undefined;
    if (cached?.hash === hash) {
      alignment = cached.alignment;
    } else {
      alignment = await synth(text, mp3);
      await writeJson(cachePath, { hash, alignment } satisfies CachedClip);
      console.log(`  voiced scene ${i + 1}/${scenes.length}${label}`);
    }

    const audioSec = await mediaDurationSec(mp3);
    const cueSec: Record<string, number> = {};
    for (const cue of cuePhrases(scene)) {
      const at = phraseStart(alignment, normalize(cue));
      if (at !== undefined) cueSec[cue] = at;
    }
    timed.push({ ...scene, audio: `${name}.mp3`, audioSec, cueSec, words: wordsFromAlignment(alignment) });

    // One transcript line per sentence, timed to when the narrator starts it
    for (const sentence of transcriptSentences(text)) {
      const startSec = phraseStart(alignment, sentence.slice(0, 40)) ?? 0;
      transcript.push({ startSec: Math.round(offsetSec + startSec), text: sentence });
    }
    offsetSec += sceneFrames(audioSec) / FPS;
  }
  return { scenes: timed, transcript, durationSec: Math.round(offsetSec) };
}

const formatLength = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export async function writeVoice(epDir: string) {
  const scenes = await readJson<(Scene | CollageScene)[]>(path.join(epDir, files.scenes));

  // Voice the episode in every KOKORO_VOICES voice; the first is the default.
  const voices = kokoroVoices();
  // Started by the first clip that isn't cached, so a fully cached episode doesn't load the model
  let tts: KokoroTts | undefined;
  const index: VoiceIndex = { default: `kokoro-${voices[0]}`, voices: [] };
  try {
    await mkdir(path.join(epDir, "voices"), { recursive: true });
    for (const [n, v] of voices.entries()) {
      const id = `kokoro-${v}`;
      const label = voices.length > 1 ? ` (${v}${n === 0 ? ", default" : ""})` : "";
      const track = await voiceTrack(epDir, scenes, `audio/${id}`, `kokoro|${v}|${kokoroSpeed()}`, (text, mp3) => (tts ??= new KokoroTts()).synthesize(text, v, mp3), label);
      const file = `voices/${id}.json`;
      await writeJson(path.join(epDir, file), track);
      index.voices.push({ id, provider: "kokoro", voice: v, durationSec: track.durationSec, file });
      if (n === 0) await writeJson(path.join(epDir, files.voice), track);
      console.log(`  narration ${formatLength(track.durationSec)}, ${track.transcript.length} transcript lines${label}`);
    }
  } finally {
    tts?.close();
  }
  await writeJson(path.join(epDir, "voices/index.json"), index);
}
