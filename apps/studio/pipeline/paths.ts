import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

export const STUDIO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WORK_DIR = path.join(STUDIO_DIR, "work");
/** The backend's catalog source; `publish` writes episodes into it. */
export const CATALOG_PATH = path.resolve(STUDIO_DIR, "../mintsy-web/apps/backend/scripts/catalog.json");
export const MEDIA_BUCKET = process.env.MEDIA_BUCKET ?? "gs://mintsy-media";

export const bookDir = (bookId: string) => path.join(WORK_DIR, bookId);
export const episodeDir = (bookId: string, chapter: number) =>
  path.join(bookDir(bookId), `ep-${String(chapter).padStart(2, "0")}`);

/** Files each step writes inside the episode folder; a step is skipped when its file exists. */
export const files = {
  book: "book.json",
  pages: "pages.json",
  chapter: "chapter.txt",
  script: "script.json",
  scenes: "scenes.json",
  voice: "voice.json",
  video: "episode.mp4",
  thumbnail: "thumbnail.jpg",
  /** Folder of HLS output, written during upload. */
  hls: "hls",
};
