import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CollageScene } from "../../src/collage/schema";
import type { Scene } from "../../src/episode/schema";
import { cuePhrases } from "../cues";
import { FPS, INTRO_SEC, sceneFrames } from "../../src/episode/timing";
import { files } from "../paths";
import { mediaDurationSec, normalize, readJson, writeJson } from "../util";

const API = "https://api.elevenlabs.io/v1";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type CachedClip = { hash: string; alignment: Alignment };

export type TranscriptLine = { startSec: number; text: string };
/** Either scene format, with its narration clip and the time each cue phrase is spoken. */
export type TimedAnyScene = (Scene | CollageScene) & { audio: string; audioSec: number; cueSec: Record<string, number> };
export type Voice = { scenes: TimedAnyScene[]; transcript: TranscriptLine[]; durationSec: number };

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

/** Seconds at which `phrase` starts in the spoken text, or undefined if it can't be found. */
function phraseStart(alignment: Alignment, phrase: string) {
  const spoken = alignment.characters.join("").toLowerCase();
  const index = spoken.indexOf(phrase.toLowerCase().trim());
  return index >= 0 ? alignment.character_start_times_seconds[index] : undefined;
}

export async function writeVoice(epDir: string) {
  const scenes = await readJson<(Scene | CollageScene)[]>(path.join(epDir, files.scenes));
  await mkdir(path.join(epDir, "audio"), { recursive: true });

  const timed: TimedAnyScene[] = [];
  const transcript: TranscriptLine[] = [];
  // The logo intro plays before the first scene
  let offsetSec = INTRO_SEC;

  for (const [i, scene] of scenes.entries()) {
    const text = normalize(scene.narration);
    const name = `audio/${String(i + 1).padStart(2, "0")}`;
    const mp3 = path.join(epDir, `${name}.mp3`);
    const cachePath = path.join(epDir, `${name}.json`);
    // Re-synthesize only when the text, voice or model changed
    const hash = createHash("sha256").update(`${voiceId()}|${MODEL_ID}|${text}`).digest("hex").slice(0, 16);

    let alignment: Alignment;
    const cached = existsSync(cachePath) && existsSync(mp3) ? await readJson<CachedClip>(cachePath) : undefined;
    if (cached?.hash === hash) {
      alignment = cached.alignment;
    } else {
      const result = await synthesize(text, scenes[i - 1]?.narration, scenes[i + 1]?.narration);
      await writeFile(mp3, result.audio);
      await writeJson(cachePath, { hash, alignment: result.alignment } satisfies CachedClip);
      alignment = result.alignment;
      console.log(`  voiced scene ${i + 1}/${scenes.length}`);
    }

    const audioSec = await mediaDurationSec(mp3);
    const cueSec: Record<string, number> = {};
    for (const cue of cuePhrases(scene)) {
      const at = phraseStart(alignment, normalize(cue));
      if (at !== undefined) cueSec[cue] = at;
    }
    timed.push({ ...scene, audio: `${name}.mp3`, audioSec, cueSec });

    // One transcript line per sentence, timed to when the narrator starts it
    for (const sentence of text.match(/[^.!?]+[.!?]+["')\]]*/g) ?? [text]) {
      const startSec = phraseStart(alignment, sentence.trim().slice(0, 40)) ?? 0;
      transcript.push({ startSec: Math.round(offsetSec + startSec), text: sentence.trim() });
    }
    offsetSec += sceneFrames(audioSec) / FPS;
  }

  const voice: Voice = { scenes: timed, transcript, durationSec: Math.round(offsetSec) };
  await writeJson(path.join(epDir, files.voice), voice);
  console.log(`  narration ${Math.floor(offsetSec / 60)}:${String(Math.round(offsetSec % 60)).padStart(2, "0")}, ${transcript.length} transcript lines`);
}
