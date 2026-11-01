import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { insertJob } from "./jobs";

export const MAX_PDF_BYTES = 200 * 1024 * 1024;

export function isPdf(bytes: Uint8Array) {
  return Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-";
}

/** Saves the PDF as UPLOAD_DIR/<bookId>.pdf and queues an ingest job for the studio worker. */
export async function saveAndQueueIngest(bookId: string, bytes: Uint8Array) {
  await mkdir(env.uploadDir, { recursive: true });
  const pdfPath = path.join(env.uploadDir, `${bookId}.pdf`);
  await writeFile(pdfPath, bytes);
  const jobId = await insertJob({ kind: "ingest", bookId, pdfPath });
  return { bookId, jobId, pdfPath };
}
