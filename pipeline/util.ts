import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export const run = promisify(execFile);

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function writeJson(file: string, data: unknown) {
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

/** Collapses whitespace and normalizes quotes so narration can be compared across steps. */
export function normalize(text: string) {
  return text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

/** Copies the shared brand audio (intro sting, music bed) into a render's public dir. */
export async function copyBrandAssets(studioDir: string, publicDir: string) {
  await mkdir(path.join(publicDir, "brand"), { recursive: true });
  for (const file of ["intro-sting.mp3", "music-bed.mp3"]) {
    await copyFile(path.join(studioDir, "brand", file), path.join(publicDir, "brand", file));
  }
}

export async function mediaDurationSec(file: string) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(stdout.trim());
}
