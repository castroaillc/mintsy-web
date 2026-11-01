import { NextResponse } from "next/server";
import { jsonError, rejectCrossOrigin } from "@/lib/api";
import { bookIdTaken } from "@/lib/catalog";
import { MAX_PDF_BYTES, isPdf, saveAndQueueIngest } from "@/lib/ingest";
import { bookIdSchema } from "@/lib/schemas";

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
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return jsonError(400, "pdf: this file isn't a PDF");

  const taken = await bookIdTaken(bookId);
  if (taken) return jsonError(409, `bookId: ${taken}`);

  return NextResponse.json(await saveAndQueueIngest(bookId, bytes), { status: 201 });
}
