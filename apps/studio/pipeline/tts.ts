/**
 * Local narration with Kokoro (apps/studio/tts/kokoro_tts.py), the voice step's only provider.
 * One Python process per voice step keeps the model loaded across scenes.
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

import { STUDIO_DIR } from "./paths";
import { run } from "./util";

/** Parallel arrays, one entry per character of the spoken text; times in seconds from the start of the clip. */
export type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type Word = { word: string; start: number; end: number };
type Reply = { id: number; ok: true; durationSec: number; words: Word[] } | { id: number; ok: false; error: string };

const TTS_DIR = path.join(STUDIO_DIR, "tts");
const SETUP = "Setup: brew install uv espeak-ng && (cd apps/studio/tts && uv sync)";

export class KokoroTts {
  private proc: ChildProcessWithoutNullStreams;
  private ready: Promise<void>;
  private pending = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private stderrTail: string[] = [];

  constructor() {
    // `uv run` would otherwise build a missing environment itself: a ~1 GB download in the middle of a job
    if (!existsSync(path.join(TTS_DIR, ".venv"))) throw new Error(`Kokoro isn't set up: apps/studio/tts/.venv is missing. ${SETUP}`);
    this.proc = spawn("uv", ["run", "--project", TTS_DIR, "--quiet", "python", "-I", path.join(TTS_DIR, "kokoro_tts.py")], {
      cwd: TTS_DIR,
      env: { ...process.env, KOKORO_WARM_VOICE: kokoroVoices()[0] },
    });
    this.proc.stderr.on("data", (chunk: Buffer) => {
      this.stderrTail.push(...chunk.toString().split("\n").filter(Boolean));
      this.stderrTail = this.stderrTail.slice(-20);
    });

    let markReady!: () => void;
    let failReady!: (e: Error) => void;
    this.ready = new Promise((resolve, reject) => {
      markReady = resolve;
      failReady = reject;
    });
    // Callers await `ready` before anything else; this only stops an unhandled rejection
    // if the process dies before anyone asked for a clip.
    this.ready.catch(() => undefined);

    createInterface({ input: this.proc.stdout }).on("line", (line) => {
      let msg: { ready?: boolean; error?: string } & Partial<Reply>;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.ready === true) return markReady();
      if (msg.ready === false) return failReady(new Error(msg.error ?? "Kokoro failed to start"));
      const waiter = msg.id !== undefined ? this.pending.get(msg.id) : undefined;
      if (waiter) {
        this.pending.delete(msg.id!);
        waiter.resolve(msg as Reply);
      }
    });
    this.proc.on("error", (err) => failReady(new Error(`Could not start Kokoro (is uv installed?): ${err.message}. ${SETUP}`)));
    this.proc.on("exit", (code) => {
      const err = new Error(
        `Kokoro exited (${code}). ${SETUP}\n${this.stderrTail.slice(-5).join("\n")}`,
      );
      failReady(err);
      for (const w of this.pending.values()) w.reject(err);
      this.pending.clear();
    });
  }

  /** Narrates `text` into `mp3Path` and returns per-character timings (see `Alignment`). */
  async synthesize(text: string, voice: string, mp3Path: string): Promise<Alignment> {
    await this.ready;
    const id = this.nextId++;
    const wav = mp3Path.replace(/\.mp3$/, ".wav");
    const reply = await new Promise<Reply>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(`${JSON.stringify({ id, text, voice, speed: kokoroSpeed(), out: wav })}\n`);
    });
    if (!reply.ok) throw new Error(`Kokoro (${voice}): ${reply.error}`);
    await run("ffmpeg", ["-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", mp3Path]);
    await rm(wav, { force: true });
    return wordsToAlignment(text, reply.words);
  }

  close() {
    this.proc.stdin.end();
    this.proc.kill();
  }
}

export function kokoroVoices() {
  const voices = (process.env.KOKORO_VOICES ?? "af_heart,am_michael,bm_george")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (voices.length === 0) throw new Error("KOKORO_VOICES is empty");
  for (const v of voices) if (!/^[a-z]{2}_[a-z0-9]+$/.test(v)) throw new Error(`KOKORO_VOICES: "${v}" isn't a Kokoro voice id (e.g. af_heart)`);
  return voices;
}

export function kokoroSpeed() {
  const speed = Number(process.env.KOKORO_SPEED ?? 1);
  return Number.isFinite(speed) && speed > 0.5 && speed < 2 ? speed : 1;
}

/**
 * Spreads word timestamps over the characters of `text`: each word's characters get that
 * word's start/end; spaces and punctuation take the start of the next word (or the end of the
 * last one), so a phrase search that begins on a space still lands on the right moment.
 */
export function wordsToAlignment(text: string, words: Word[]): Alignment {
  const characters = text.split("");
  const starts: (number | undefined)[] = new Array(characters.length).fill(undefined);
  const ends: (number | undefined)[] = new Array(characters.length).fill(undefined);
  const lower = text.toLowerCase();
  let pos = 0;
  for (const w of words) {
    const token = w.word.trim().toLowerCase();
    if (!token) continue;
    const at = lower.indexOf(token, pos);
    // Kokoro can split or normalise tokens differently from the text; skip what we can't place
    // rather than jumping ahead and mistiming everything after it.
    if (at < 0 || at - pos > 40) continue;
    for (let k = at; k < at + token.length; k++) {
      starts[k] = w.start;
      ends[k] = w.end;
    }
    pos = at + token.length;
  }
  let next = words.length ? words[words.length - 1].end : 0;
  for (let k = characters.length - 1; k >= 0; k--) {
    if (starts[k] === undefined) {
      starts[k] = next;
      ends[k] = next;
    } else next = starts[k]!;
  }
  return { characters, character_start_times_seconds: starts as number[], character_end_times_seconds: ends as number[] };
}
