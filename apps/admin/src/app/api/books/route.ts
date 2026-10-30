import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { jsonError, rejectCrossOrigin } from "@/lib/api";
import { bookIdTaken } from "@/lib/catalog";
import { env } from "@/lib/env";
import { insertJob } from "@/lib/jobs";
import { bookIdSchema } from "@/lib/schemas";

const MAX_PDF_BYTES = 200 * 1024 * 1024;

/** New book: multipart form with `bookId` + `pdf`. Saves the PDF and queues an ingest job. */
export async function POST(req: Request) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Expected multipart/form-data with bookId and pdf");
  }
  const id = bookIdSchema.safeParse(form.get("bookId"));
  if (!id.success) return jsonError(400, `bookId: ${id.error.issues[0]?.message ?? "invalid"}`);
  const bookId = id.data;

  const file = form.get("pdf");
  if (!(file instanceof File) || file.size === 0) return jsonError(400, "pdf: choose a PDF file");
  if (file.size > MAX_PDF_BYTES) return jsonError(400, "pdf: larger than 200 MB");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return jsonError(400, "pdf: this file isn't a PDF");

  const taken = await bookIdTaken(bookId);
  if (taken) return jsonError(409, `bookId: ${taken}`);

  await mkdir(env.uploadDir, { recursive: true });
  const pdfPath = path.join(env.uploadDir, `${bookId}.pdf`);
  await writeFile(pdfPath, bytes);

  const jobId = await insertJob({ kind: "ingest", bookId, pdfPath });
  return NextResponse.json({ bookId, jobId, pdfPath }, { status: 201 });
}
