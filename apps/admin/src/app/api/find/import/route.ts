import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { fetchFromSource, gutenbergTextToPdf, isAllowedSourceUrl, isGutenbergText } from "@/lib/book-sources";
import { bookIdTaken } from "@/lib/catalog";
import { MAX_PDF_BYTES, isPdf, saveAndQueueIngest } from "@/lib/ingest";
import { bookIdSchema } from "@/lib/schemas";

const bodySchema = z.object({
  bookId: bookIdSchema,
  url: z.string().refine(isAllowedSourceUrl, "not a known book source"),
});

/**
 * POST /api/find/import { bookId, url }: downloads a PDF from a known book source,
 * saves it as UPLOAD_DIR/<bookId>.pdf and queues an ingest job (same as New book).
 */
export async function POST(req: Request) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const { bookId, url } = parsed.data;

  const taken = await bookIdTaken(bookId);
  if (taken) return jsonError(409, `bookId: ${taken}`);

  if (isGutenbergText(url)) {
    let pdf: Buffer;
    try {
      pdf = await gutenbergTextToPdf(url);
    } catch (err) {
      return jsonError(502, err instanceof Error ? err.message : "Conversion failed");
    }
    if (pdf.length > MAX_PDF_BYTES) return jsonError(400, "pdf: larger than 200 MB");
    if (!isPdf(pdf)) return jsonError(502, "Conversion didn't produce a PDF");
    const takenNow = await bookIdTaken(bookId);
    if (takenNow) return jsonError(409, `bookId: ${takenNow}`);
    return NextResponse.json(await saveAndQueueIngest(bookId, pdf), { status: 201 });
  }

  let res: Response;
  try {
    res = await fetchFromSource(url, { timeoutMs: 300_000 });
  } catch (err) {
    return jsonError(502, err instanceof Error ? err.message : "Download failed");
  }
  if (!res.ok || !res.body) return jsonError(502, `Source returned HTTP ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_PDF_BYTES) {
    await res.body.cancel();
    return jsonError(400, "pdf: larger than 200 MB");
  }

  // Read with a hard cap in case the source didn't send a length.
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PDF_BYTES) {
      await reader.cancel();
      return jsonError(400, "pdf: larger than 200 MB");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  if (!isPdf(bytes)) return jsonError(400, "pdf: the downloaded file isn't a PDF");

  // Re-check: the download can take a while.
  const takenNow = await bookIdTaken(bookId);
  if (takenNow) return jsonError(409, `bookId: ${takenNow}`);

  return NextResponse.json(await saveAndQueueIngest(bookId, bytes), { status: 201 });
}
