/**
 * HLS for an episode: encodes episode.mp4 with pipeline/transcode.sh (local ffmpeg) and uploads the
 * result beside the MP4. Bucket layout: `<prefix>/master.m3u8` + `<prefix>/stream_N/{playlist.m3u8,init_N.mp4,seg_*.m4s}`.
 */
import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { MEDIA_BUCKET, STUDIO_DIR } from "../paths";

const TRANSCODE_SCRIPT = path.join(STUDIO_DIR, "pipeline/transcode.sh");
export const MASTER_PLAYLIST = "master.m3u8";

const CONTENT_TYPES = { m3u8: "application/vnd.apple.mpegurl", m4s: "video/iso.segment", mp4: "video/mp4" };

/**
 * Runs a command in its own process group, so the first Ctrl-C (which means "stop after the current
 * job", see worker.ts) doesn't reach it through the terminal. If the worker exits, the group goes too.
 */
function runIsolated(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: ["ignore", "ignore", "pipe"] });
    const killGroup = () => {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          // already gone
        }
      }
    };
    process.once("exit", killGroup);
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    child.once("error", (err) => {
      process.off("exit", killGroup);
      reject(new Error(`could not run ${command}: ${err.message}`));
    });
    child.once("close", (code, signal) => {
      process.off("exit", killGroup);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} exited with ${signal ?? `code ${code}`}`));
    });
  });
}

/** Encodes into `outDir`, deleted first so a re-render can't mix old and new segments. */
export async function encodeHls(video: string, outDir: string) {
  await rm(outDir, { recursive: true, force: true });
  console.log("hls: encoding");
  const started = Date.now();
  try {
    await runIsolated("bash", [TRANSCODE_SCRIPT, video, outDir]);
  } catch (err) {
    throw new Error(`HLS encoding failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log(`hls: encoded in ${Math.round((Date.now() - started) / 1000)}s`);
}

const inStream = (dir: string, stream: string, names: string[]) => names.map((n) => path.join(dir, stream, n));

/** The encoded files as upload batches, in upload order: media, then each playlist, then master last. */
export async function hlsUploadPlan(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  const streams = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const master = entries.find((e) => e.isFile() && e.name === MASTER_PLAYLIST);
  if (!master || streams.length === 0) throw new Error(`HLS output in ${dir} is incomplete (needs ${MASTER_PLAYLIST} and stream folders)`);
  const unexpected = entries.filter((e) => e.isFile() && e.name !== MASTER_PLAYLIST).map((e) => e.name);

  const media: { files: string[]; subdir: string; contentType: string }[] = [];
  const playlists: typeof media = [];
  for (const stream of streams) {
    const names = await readdir(path.join(dir, stream));
    const byExt = (ext: string) => names.filter((n) => n.endsWith(`.${ext}`));
    const [segments, inits, lists] = [byExt("m4s"), byExt("mp4"), byExt("m3u8")];
    if (segments.length === 0 || inits.length === 0 || lists.length === 0) {
      throw new Error(`HLS output in ${path.join(dir, stream)} is incomplete (needs a playlist, an init file and segments)`);
    }
    unexpected.push(...names.filter((n) => !/\.(m4s|mp4|m3u8)$/.test(n)));
    media.push(
      { files: inStream(dir, stream, segments), subdir: stream, contentType: CONTENT_TYPES.m4s },
      { files: inStream(dir, stream, inits), subdir: stream, contentType: CONTENT_TYPES.mp4 },
    );
    playlists.push({ files: inStream(dir, stream, lists), subdir: stream, contentType: CONTENT_TYPES.m3u8 });
  }
  if (unexpected.length > 0) throw new Error(`Unexpected files in HLS output: ${unexpected.join(", ")}`);
  return [...media, ...playlists, { files: [path.join(dir, MASTER_PLAYLIST)], subdir: "", contentType: CONTENT_TYPES.m3u8 }];
}

/** Uploads everything under `<prefix>/`. `master.m3u8` goes last, so it only exists once all it points to does. */
export async function uploadHls(dir: string, prefix: string, cacheControl: string) {
  const batches = await hlsUploadPlan(dir);
  const total = batches.reduce((sum, batch) => sum + batch.files.length, 0);
  console.log(`hls: uploading ${total} files`);
  for (const { files, subdir, contentType } of batches) {
    const dest = `${MEDIA_BUCKET}/${prefix}/${subdir ? `${subdir}/` : ""}`;
    try {
      await runIsolated("gcloud", ["storage", "cp", ...files, dest, "--content-type", contentType, "--cache-control", cacheControl]);
    } catch (err) {
      throw new Error(`HLS upload to ${dest} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`hls: uploaded ${total} files`);
}
