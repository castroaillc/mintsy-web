import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { bookDir, CATALOG_PATH, files, MEDIA_BUCKET } from "../paths";
import { readJson, run, writeJson } from "../util";
import type { BookInfo } from "./ingest";
import type { Script } from "./script";
import type { TranscriptLine, Voice } from "./voice";

/** Episode fields shared by catalog.json (legacy) and the `books` collection. */
export type CatalogEpisode = {
  number: number;
  title: string;
  summary: string;
  durationSec: number;
  transcript: TranscriptLine[];
  takeaways: string[];
  videoPath?: string;
  thumbnailPath?: string;
};
type CatalogBook = Omit<BookInfo, "chapters"> & { id: string; order: number; episodes: CatalogEpisode[] };

async function shortHash(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex").slice(0, 8);
}

/** Bucket object prefix for an episode: `books/<bookId>/<chapter>-<first 8 hex of sha256(mp4)>`. */
export const mediaPrefix = (bookId: string, chapter: number, hash: string) => `books/${bookId}/${chapter}-${hash}`;

/**
 * Uploads episode.mp4 + thumbnail.jpg to the media bucket under a content-hashed name.
 * The bucket may be private: the backend serves media through short-lived signed URLs,
 * so objects are `private` (no shared/CDN caching). Names are content-hashed, so the
 * viewer's own cache can still keep them for a year; a re-rendered episode gets a new name.
 */
export async function uploadMedia(bookId: string, chapter: number, epDir: string) {
  const video = path.join(epDir, files.video);
  const thumbnail = path.join(epDir, files.thumbnail);
  const prefix = mediaPrefix(bookId, chapter, await shortHash(video));
  const videoPath = `${prefix}.mp4`;
  const thumbnailPath = `${prefix}.jpg`;
  for (const [local, remote] of [[video, videoPath], [thumbnail, thumbnailPath]]) {
    await run("gcloud", ["storage", "cp", local, `${MEDIA_BUCKET}/${remote}`, "--cache-control", "private, max-age=31536000"]);
  }
  console.log(`  uploaded ${MEDIA_BUCKET}/${prefix}.{mp4,jpg}`);
  return { videoPath, thumbnailPath };
}

/** The episode's catalog fields from its script.json and voice.json (no media paths). */
export async function episodeFields(chapter: number, epDir: string): Promise<CatalogEpisode> {
  const script = await readJson<Script>(path.join(epDir, files.script));
  const voice = await readJson<Voice>(path.join(epDir, files.voice));
  return {
    number: chapter,
    title: script.title,
    summary: script.summary,
    durationSec: voice.durationSec,
    transcript: voice.transcript,
    takeaways: script.takeaways,
  };
}

/** Legacy: uploads the episode and writes it into the backend's catalog.json. The worker writes MongoDB instead. */
export async function publish(bookId: string, chapter: number, epDir: string) {
  const book = await readJson<BookInfo>(path.join(bookDir(bookId), files.book));
  const fields = await episodeFields(chapter, epDir);
  const { videoPath, thumbnailPath } = await uploadMedia(bookId, chapter, epDir);

  const catalog = await readJson<CatalogBook[]>(CATALOG_PATH);
  let entry = catalog.find((b) => b.id === bookId);
  if (!entry) {
    const { chapters: _chapters, ...meta } = book;
    entry = { id: bookId, ...meta, order: catalog.length, episodes: [] };
    catalog.push(entry);
    console.log(`  added book "${book.title}" to the catalog`);
  }

  const episode: CatalogEpisode = { ...fields, videoPath, thumbnailPath };
  entry.episodes = [...entry.episodes.filter((e) => e.number !== chapter), episode].sort((a, b) => a.number - b.number);
  await writeJson(CATALOG_PATH, catalog);
  console.log(`  updated ${path.relative(process.cwd(), CATALOG_PATH)}; run \`pnpm seed:catalog\` in backend/ to load it`);
}
