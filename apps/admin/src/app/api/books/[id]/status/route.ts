import { NextResponse } from "next/server";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { booksCol } from "@/lib/mongo";
import { statusSchema } from "@/lib/schemas";
import { canPublishBook } from "@/lib/status";

/**
 * Publish / unpublish a whole book. Publishing goes live in the app immediately, with the book's
 * published run, so it's refused if the API couldn't serve that run. Unpublishing is never refused.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/status">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id } = await ctx.params;
  const parsed = statusSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const books = await booksCol();
  if (parsed.data.status === "published") {
    const book = await books.findOne({ _id: id }, { projection: { episodes: 1 } });
    if (!book) return jsonError(404, "Book not found");
    const check = canPublishBook(book.episodes ?? []);
    if (!check.ok) return jsonError(409, check.reason);
  }

  const res = await books.updateOne(
    { _id: id },
    { $set: { status: parsed.data.status, updatedAt: new Date() } },
  );
  if (!res.matchedCount) return jsonError(404, "Book not found");
  return NextResponse.json({ ok: true, status: parsed.data.status });
}
