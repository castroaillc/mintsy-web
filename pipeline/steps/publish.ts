import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { bookDir, CATALOG_PATH, files, MEDIA_BUCKET } from "../paths";
import { readJson, run, writeJson } from "../util";
import type { BookInfo } from "./ingest";
import type { Script } from "./script";
import type { Voice } from "./voice";

type CatalogEpisode = {
  number: number;
  title: string;
  summary: string;
  durationSec: number;
  transcript: { startSec: number; text: string }[];
  takeaways: string[];
  videoPath?: string;
  thumbnailPath?: string;
};
type CatalogBook = Omit<BookInfo, "chapters"> & { id: string; order: number; episodes: CatalogEpisode[] };

async function shortHash(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex").slice(0, 8);
}

/** Uploads the episode to the media bucket and writes it into the backend's catalog.json. */
export async function publish(bookId: string, chapter: number, epDir: string) {
  const book = await readJson<BookInfo>(path.join(bookDir(bookId), files.book));
  const script = await readJson<Script>(path.join(epDir, files.script));
  const voice = await readJson<Voice>(path.join(epDir, files.voice));

  // Objects are cached for a year, so a re-rendered episode gets a new name
  const video = path.join(epDir, files.video);
  const thumbnail = path.join(epDir, files.thumbnail);
  const prefix = `books/${bookId}/${chapter}-${await shortHash(video)}`;
  const videoPath = `${prefix}.mp4`;
  const thumbnailPath = `${prefix}.jpg`;
  for (const [local, remote] of [[video, videoPath], [thumbnail, thumbnailPath]]) {
    await run("gcloud", ["storage", "cp", local, `${MEDIA_BUCKET}/${remote}`, "--cache-control", "public, max-age=31536000"]);
  }
  console.log(`  uploaded ${MEDIA_BUCKET}/${prefix}.{mp4,jpg}`);

  const catalog = await readJson<CatalogBook[]>(CATALOG_PATH);
  let entry = catalog.find((b) => b.id === bookId);
  if (!entry) {
    const { chapters: _chapters, ...meta } = book;
    entry = { id: bookId, ...meta, order: catalog.length, episodes: [] };
    catalog.push(entry);
    console.log(`  added book "${book.title}" to the catalog`);
  }

  const episode: CatalogEpisode = {
    number: chapter,
    title: script.title,
    summary: script.summary,
    durationSec: voice.durationSec,
    transcript: voice.transcript,
    takeaways: script.takeaways,
    videoPath,
    thumbnailPath,
  };
  entry.episodes = [...entry.episodes.filter((e) => e.number !== chapter), episode].sort((a, b) => a.number - b.number);
  await writeJson(CATALOG_PATH, catalog);
  console.log(`  updated ${path.relative(process.cwd(), CATALOG_PATH)}; run \`pnpm seed:catalog\` in backend/ to load it`);
}
