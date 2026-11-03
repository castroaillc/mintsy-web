import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

import type { BookCoverProps } from "../../src/collage/covers";
import { bookDir, MEDIA_BUCKET, STUDIO_DIR } from "../paths";
import { run } from "../util";

/** Local cover file for a book: work/<book>/cover.jpg (1000×1500). */
export const coverFile = (bookId: string) => path.join(bookDir(bookId), "cover.jpg");

/** Renders the BookCover composition (src/collage/covers.tsx) to work/<book>/cover.jpg. */
export async function renderCover(bookId: string, props: BookCoverProps) {
  const out = coverFile(bookId);
  await mkdir(path.dirname(out), { recursive: true });
  console.log("  bundling");
  const serveUrl = await bundle({ entryPoint: path.join(STUDIO_DIR, "src/index.ts") });
  const composition = await selectComposition({ serveUrl, id: "BookCover", inputProps: props });
  await renderStill({ serveUrl, composition, inputProps: props, output: out, imageFormat: "jpeg", jpegQuality: 90 });
  console.log(`  wrote ${path.relative(STUDIO_DIR, out)}`);
  return out;
}

/** Uploads the local cover as books/<book>/cover-<sha256 8>.jpg; a changed cover gets a new name. */
export async function uploadCover(bookId: string) {
  const file = coverFile(bookId);
  const hash = createHash("sha256").update(await readFile(file)).digest("hex").slice(0, 8);
  const coverPath = `books/${bookId}/cover-${hash}.jpg`;
  await run("gcloud", ["storage", "cp", file, `${MEDIA_BUCKET}/${coverPath}`, "--cache-control", "private, max-age=31536000"]);
  console.log(`  uploaded ${MEDIA_BUCKET}/${coverPath}`);
  return coverPath;
}
