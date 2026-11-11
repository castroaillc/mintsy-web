import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { EpisodeDoc } from "@mintsy/shared";

import { uploadEnv } from "../gcloud";
import { bookDir, CATALOG_PATH, files, MEDIA_BUCKET } from "../paths";
import { readJson, run, writeJson } from "../util";
import {
  checkEpisodeVoices,
  checkVoiceText,
  type EpisodeVoiceDoc,
  type EpisodeVoiceText,
  type RenderTarget,
  renderTargets,
  trackStamp,
  voiceText,
  wholeSecondTranscript,
} from "../voices";
import { encodeHls, MASTER_PLAYLIST, uploadHls } from "./hls";
import type { BookInfo } from "./ingest";
import type { Script } from "./script";

/** Episode fields shared by catalog.json (legacy) and the `books` collection. */
export type CatalogEpisode = Omit<EpisodeDoc, "status" | "updatedAt">;
/** From episodeFields: everything except the media, which uploadMedia adds. */
export type EpisodeFields = Omit<CatalogEpisode, "voices"> & { voices: EpisodeVoiceText[] };
type CatalogBook = Omit<BookInfo, "chapters"> & { id: string; order: number; episodes: CatalogEpisode[] };

async function shortHash(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex").slice(0, 8);
}

/** Bucket object prefix for an episode: `books/<bookId>/<chapter>-<first 8 hex of sha256(mp4)>`. */
export const mediaPrefix = (bookId: string, chapter: number, hash: string) => `books/${bookId}/${chapter}-${hash}`;

const CACHE_CONTROL = "private, max-age=31536000";

export type EpisodeMedia = { videoPath: string; thumbnailPath: string; hlsPath: string; voices: EpisodeVoiceDoc[] };

/**
 * Encodes every voice's episode.mp4 to HLS, then uploads each MP4 and its HLS files, plus the
 * episode's thumbnail.jpg, to the media bucket under content-hashed names, one prefix per voice.
 * The top-level paths are the default voice's. Encoding comes first, so a failed encode uploads
 * nothing; callers save the episode only after this resolves, so it never points to a partial upload.
 * An episode voiced before Kokoro has one video and `voices: []`.
 * The bucket may be private: the backend serves media through short-lived signed URLs,
 * so objects are `private` (no shared/CDN caching). Names are content-hashed, so the
 * viewer's own cache can still keep them for a year; a re-rendered episode gets a new name.
 */
export async function uploadMedia(bookId: string, chapter: number, epDir: string, fields: EpisodeFields): Promise<EpisodeMedia> {
  checkVoiceText(fields.voices);
  const env = uploadEnv();
  const targets = await renderTargets(epDir);
  const thumbnail = path.join(epDir, files.thumbnail);
  if (!existsSync(thumbnail)) throw new Error(`No ${files.thumbnail} in ${epDir}: render it first`);

  const items: { target: RenderTarget; video: string; prefix: string; hlsDir: string }[] = [];
  for (const target of targets) {
    const video = path.join(target.outDir, files.video);
    if (!existsSync(video)) throw new Error(`Track "${target.trackId}" has no ${files.video}: rerun with --from render`);
    // A render from before captions came off has no stamp; one from an older voice step has a different one
    if (target.voice) {
      const stampPath = path.join(target.outDir, files.renderStamp);
      const stamp = existsSync(stampPath) ? (await readJson<{ track?: string }>(stampPath)).track : undefined;
      if (stamp !== trackStamp(target.track)) throw new Error(`Track "${target.trackId}" has changed since ${path.relative(epDir, video)} was rendered: rerun with --from render`);
    }
    const prefix = mediaPrefix(bookId, chapter, await shortHash(video));
    items.push({ target, video, prefix, hlsDir: path.join(target.outDir, files.hls) });
  }

  for (const { target, video, hlsDir } of items) {
    if (targets.length > 1) console.log(`hls: ${target.trackId}`);
    await encodeHls(video, hlsDir);
  }
  for (const { video, prefix, hlsDir } of items) {
    await run("gcloud", ["storage", "cp", video, `${MEDIA_BUCKET}/${prefix}.mp4`, "--cache-control", CACHE_CONTROL], { env });
    console.log(`  uploaded ${MEDIA_BUCKET}/${prefix}.mp4`);
    await uploadHls(hlsDir, prefix, CACHE_CONTROL, env);
  }
  const main = items[0].prefix;
  await run("gcloud", ["storage", "cp", thumbnail, `${MEDIA_BUCKET}/${main}.jpg`, "--cache-control", CACHE_CONTROL], { env });
  console.log(`  uploaded ${MEDIA_BUCKET}/${main}.jpg`);

  return {
    videoPath: `${main}.mp4`,
    thumbnailPath: `${main}.jpg`,
    hlsPath: `${main}/${MASTER_PLAYLIST}`,
    voices: fields.voices.map((voice, i) => ({
      ...voice,
      videoPath: `${items[i].prefix}.mp4`,
      hlsPath: `${items[i].prefix}/${MASTER_PLAYLIST}`,
    })),
  };
}

/** The episode's catalog fields from its script.json and voice tracks (no media paths). The top-level ones are the default voice's. */
export async function episodeFields(chapter: number, epDir: string): Promise<EpisodeFields> {
  const script = await readJson<Script>(path.join(epDir, files.script));
  const targets = await renderTargets(epDir);
  const main = targets[0].track;
  const voices = targets.filter((t) => t.voice).map(voiceText);
  checkVoiceText(voices);
  return {
    number: chapter,
    title: script.title,
    summary: script.summary,
    durationSec: Math.round(main.durationSec),
    transcript: wholeSecondTranscript(main.transcript),
    takeaways: script.takeaways,
    voices,
  };
}

/** Legacy: uploads the episode and writes it into the backend's catalog.json. The worker writes MongoDB instead. */
export async function publish(bookId: string, chapter: number, epDir: string) {
  const book = await readJson<BookInfo>(path.join(bookDir(bookId), files.book));
  const fields = await episodeFields(chapter, epDir);
  const media = await uploadMedia(bookId, chapter, epDir, fields);

  const catalog = await readJson<CatalogBook[]>(CATALOG_PATH);
  let entry = catalog.find((b) => b.id === bookId);
  if (!entry) {
    const { chapters: _chapters, ...meta } = book;
    entry = { id: bookId, ...meta, order: catalog.length, episodes: [] };
    catalog.push(entry);
    console.log(`  added book "${book.title}" to the catalog`);
  }

  const episode: CatalogEpisode = { ...fields, ...media };
  checkEpisodeVoices(episode);
  entry.episodes = [...entry.episodes.filter((e) => e.number !== chapter), episode].sort((a, b) => a.number - b.number);
  await writeJson(CATALOG_PATH, catalog);
  console.log(`  updated ${path.relative(process.cwd(), CATALOG_PATH)}; run \`pnpm --filter mintsy-backend seed:catalog\` from the repo root to load it`);
}
