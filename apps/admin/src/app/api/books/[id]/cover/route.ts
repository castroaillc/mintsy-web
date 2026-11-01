import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { insertJob, outdatedWorkerError } from "@/lib/jobs";
import { booksCol, jobsCol } from "@/lib/mongo";
import { bookIdSchema, coverJobSchema } from "@/lib/schemas";
import { coverPath } from "@/lib/studio-work";

/** GET /api/books/:id/cover serves the locally rendered cover (studio/work/<book>/cover.jpg). */
export async function GET(_req: Request, ctx: RouteContext<"/api/books/[id]/cover">) {
  const { id } = await ctx.params;
  const book = bookIdSchema.safeParse(id);
  if (!book.success) return jsonError(404, "Not found");
  const file = coverPath(book.data);
  try {
    const { size } = await stat(file);
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: { "content-type": "image/jpeg", "content-length": String(size), "cache-control": "no-cache" },
    });
  } catch {
    return jsonError(404, "No cover rendered yet");
  }
}

/**
 * POST /api/books/:id/cover { upload? } queues a `cover` job: the worker renders the cover from the
 * book's current metadata; with upload it's also uploaded and set as the book's coverPath.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/cover">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id: bookId } = await ctx.params;
  const parsed = coverJobSchema.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);
  if (!(await (await booksCol()).findOne({ _id: bookId }, { projection: { _id: 1 } }))) return jsonError(404, "Book not found");
  const outdated = await outdatedWorkerError("cover");
  if (outdated) return jsonError(409, outdated);
  const active = await (await jobsCol()).countDocuments({ bookId, kind: "cover", status: { $in: ["queued", "running"] } }, { limit: 1 });
  if (active) return jsonError(409, "A cover job is already queued or running");
  const jobId = await insertJob({ kind: "cover", bookId, ...(parsed.data.upload ? { upload: true } : {}) });
  return NextResponse.json({ jobId }, { status: 201 });
}
