import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";

import { generate } from "../claude";
import { bookDir, files } from "../paths";
import { readJson, writeJson } from "../util";

export const CATEGORIES = ["Finance", "Business", "Psychology", "Productivity", "History", "Health"] as const;

export const BookInfo = z.object({
  title: z.string(),
  author: z.string(),
  category: z.enum(CATEGORIES),
  description: z.string().describe("One or two sentences for the app's series page, in our own words"),
  coverTone: z.string().describe("Hex color for the generated cover tile, e.g. #E7DFCF"),
  tint: z.string().describe("Dark hex color (luminance under 25%) for backdrops, related to coverTone, e.g. #3B3426"),
  chapters: z
    .array(
      z.object({
        number: z.number().int().describe("1-based, counting only main content chapters"),
        title: z.string(),
        startPage: z.number().int().describe("PDF page index from the [page N] markers"),
        endPage: z.number().int(),
      }),
    )
    .describe("Main content chapters only: no front matter, acknowledgements, notes or index"),
});
export type BookInfo = z.infer<typeof BookInfo>;

/** PDF → per-page text, then Claude reads the whole book once to find its metadata and chapter boundaries. */
export async function ingest(pdfPath: string, bookId: string) {
  const dir = bookDir(bookId);
  await mkdir(dir, { recursive: true });

  const pagesPath = path.join(dir, files.pages);
  let pages: string[];
  if (existsSync(pagesPath)) {
    pages = await readJson(pagesPath);
  } else {
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(pdfPath)));
    pages = (await extractText(pdf, { mergePages: false })).text;
    if (pages.join("").trim().length < 1000) {
      throw new Error("The PDF has almost no extractable text. It may be scanned images, which need OCR first.");
    }
    await writeJson(pagesPath, pages);
    console.log(`  extracted ${pages.length} pages`);
  }

  const bookPath = path.join(dir, files.book);
  if (existsSync(bookPath)) {
    console.log(`  ${files.book} exists, skipping`);
    return readJson<BookInfo>(bookPath);
  }

  const book = await generate({
    label: "book info + chapters",
    schema: BookInfo,
    effort: "medium",
    system:
      "You catalog books for mintsy, an app that turns each chapter of a nonfiction book into a 5-minute video episode. " +
      "Identify the book's metadata and the page range of each main chapter. Page numbers must be the PDF page indices " +
      "from the [page N] markers, not the printed page numbers. A chapter ends on the page before the next one starts.",
    messages: [{ role: "user", content: pagesWithMarkers(pages) }],
  });
  await writeJson(bookPath, book);
  return book;
}

export function pagesWithMarkers(pages: string[], from = 1, to = pages.length) {
  return pages
    .slice(from - 1, to)
    .map((text, i) => `[page ${from + i}]\n${text}`)
    .join("\n\n");
}

export async function writeChapter(bookId: string, chapter: number, epDir: string) {
  const book = await readJson<BookInfo>(path.join(bookDir(bookId), files.book));
  const pages = await readJson<string[]>(path.join(bookDir(bookId), files.pages));
  const info = book.chapters.find((c) => c.number === chapter);
  if (!info) throw new Error(`Chapter ${chapter} not found. Chapters: 1–${book.chapters.length}`);
  await mkdir(epDir, { recursive: true });
  const text = `Chapter ${info.number}: ${info.title}\n\n${pagesWithMarkers(pages, info.startPage, info.endPage)}`;
  await writeFile(path.join(epDir, files.chapter), text);
  console.log(`  chapter ${info.number} "${info.title}": pages ${info.startPage}–${info.endPage}, ${text.split(/\s+/).length} words`);
}
