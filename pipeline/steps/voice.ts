import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CollageScene } from "../../src/collage/schema";
import type { Scene } from "../../src/episode/schema";
import { cuePhrases } from "../cues";
import { FPS, INTRO_SEC, sceneFrames } from "../../src/episode/timing";
import { files } from "../paths";
import { type Alignment, KokoroTts, kokoroSpeed, kokoroVoices } from "../tts";
import { mediaDurationSec, normalize, readJson, writeJson } from "../util";

const API = "https://api.elevenlabs.io/v1";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

/** `elevenlabs` (default) or `kokoro` (local, see studio/tts/README.md). */
function provider() {
  const p = process.env.TTS_PROVIDER ?? "elevenlabs";
  if (p !== "elevenlabs" && p !== "kokoro") throw new Error(`TTS_PROVIDER must be elevenlabs or kokoro, not "${p}"`);
  return p;
}

type CachedClip = { hash: string; alignment: Alignment };

export type TranscriptLine = { startSec: number; text: string };
/** Either scene format, with its narration clip and the time each cue phrase is spoken. */
/** One spoken word, in seconds from the start of its scene's clip. */
export type SpokenWord = { text: string; startSec: number; endSec: number };
export type TimedAnyScene = (Scene | CollageScene) & {
  audio: string;
  audioSec: number;
  cueSec: Record<string, number>;
  /** Every word with its timing (for word-synced captions); additive, older voice.json files lack it. */
  words: SpokenWord[];
};
export type Voice = { scenes: TimedAnyScene[]; transcript: TranscriptLine[]; durationSec: number };
/** voices/index.json: every narration track stored for the episode (for a future in-app voice choice). */
export type VoiceIndex = {
  default: string;
  voices: { id: string; provider: "kokoro" | "elevenlabs"; voice: string; durationSec: number; file: string }[];
};

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Set ELEVENLABS_API_KEY in studio/.env");
  return key;
}

function voiceId() {
  const id = process.env.ELEVENLABS_VOICE_ID;
  if (!id) throw new Error("Set ELEVENLABS_VOICE_ID in studio/.env (run `pnpm run pipeline voices` to list them)");
  return id;
}

export async function listVoices() {
  const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": apiKey() } });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  const { voices } = (await res.json()) as { voices: { voice_id: string; name: string; labels?: Record<string, string> }[] };
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  ${Object.values(v.labels ?? {}).join(", ")}`);
}

/** Narrates one scene; neighbouring text keeps intonation continuous across clips. */
async function synthesize(text: string, previousText: string | undefined, nextText: string | undefined) {
  const res = await fetch(`${API}/text-to-speech/${voiceId()}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      previous_text: previousText,
      next_text: nextText,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { audio_base64: string; alignment: Alignment | null };
  if (!json.alignment) throw new Error("ElevenLabs returned no alignment");
  return { audio: Buffer.from(json.audio_base64, "base64"), alignment: json.alignment };
}

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
type Synth = (text: string, previousText: string | undefined, nextText: string | undefined, mp3: string) => Promise<Alignment>;

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
    // Re-synthesize only when the text, voice or model changed
    const hash = createHash("sha256").update(`${cacheKey}|${text}`).digest("hex").slice(0, 16);

    let alignment: Alignment;
    const cached = existsSync(cachePath) && existsSync(mp3) ? await readJson<CachedClip>(cachePath) : undefined;
    if (cached?.hash === hash) {
      alignment = cached.alignment;
    } else {
      alignment = await synth(text, scenes[i - 1]?.narration, scenes[i + 1]?.narration, mp3);
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
    for (const sentence of text.match(/[^.!?]+[.!?]+["')\]]*/g) ?? [text]) {
      const startSec = phraseStart(alignment, sentence.trim().slice(0, 40)) ?? 0;
      transcript.push({ startSec: Math.round(offsetSec + startSec), text: sentence.trim() });
    }
    offsetSec += sceneFrames(audioSec) / FPS;
  }
  return { scenes: timed, transcript, durationSec: Math.round(offsetSec) };
}

const formatLength = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export async function writeVoice(epDir: string) {
  const scenes = await readJson<(Scene | CollageScene)[]>(path.join(epDir, files.scenes));

  if (provider() === "elevenlabs") {
    const synth: Synth = async (text, prev, next, mp3) => {
      const result = await synthesize(text, prev, next);
      await writeFile(mp3, result.audio);
      return result.alignment;
    };
    const voice = await voiceTrack(epDir, scenes, "audio", `${voiceId()}|${MODEL_ID}`, synth);
    await writeJson(path.join(epDir, files.voice), voice);
    console.log(`  narration ${formatLength(voice.durationSec)}, ${voice.transcript.length} transcript lines`);
    return;
  }

  // Kokoro: voice the episode in every KOKORO_VOICES voice; the first is rendered.
  const voices = kokoroVoices();
  const tts = new KokoroTts();
  const index: VoiceIndex = { default: `kokoro-${voices[0]}`, voices: [] };
  try {
    await mkdir(path.join(epDir, "voices"), { recursive: true });
    for (const [n, v] of voices.entries()) {
      const id = `kokoro-${v}`;
      const label = voices.length > 1 ? ` (${v}${n === 0 ? ", default" : ""})` : "";
      const track = await voiceTrack(epDir, scenes, `audio/${id}`, `kokoro|${v}|${kokoroSpeed()}`, (text, _p, _n, mp3) => tts.synthesize(text, v, mp3), label);
      const file = `voices/${id}.json`;
      await writeJson(path.join(epDir, file), track);
      index.voices.push({ id, provider: "kokoro", voice: v, durationSec: track.durationSec, file });
      if (n === 0) await writeJson(path.join(epDir, files.voice), track);
      console.log(`  narration ${formatLength(track.durationSec)}, ${track.transcript.length} transcript lines${label}`);
    }
  } finally {
    tts.close();
  }
  await writeJson(path.join(epDir, "voices/index.json"), index);
}
