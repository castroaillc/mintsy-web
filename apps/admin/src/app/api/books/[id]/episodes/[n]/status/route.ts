import { NextResponse } from "next/server";
import { jsonError, parseEpisodeNumber, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { booksCol } from "@/lib/mongo";
import { statusSchema } from "@/lib/schemas";
import { canPublishEpisode, canUnpublishEpisode } from "@/lib/status";

/**
 * Publish / unpublish one episode. Enforces the contiguous-run rule:
 * publish n only when 1..n-1 are published; unpublish only the highest published.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/episodes/[n]/status">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id, n: nRaw } = await ctx.params;
  const n = parseEpisodeNumber(nRaw);
  if (!n) return jsonError(400, "Episode number must be a positive integer");
  const parsed = statusSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const target = parsed.data.status;

  const books = await booksCol();
  const book = await books.findOne({ _id: id });
  if (!book) return jsonError(404, "Book not found");

  const check = target === "published" ? canPublishEpisode(book.episodes, n) : canUnpublishEpisode(book.episodes, n);
  if (!check.ok) return jsonError(409, check.reason);

  const now = new Date();
  await books.updateOne(
    { _id: id, "episodes.number": n },
    { $set: { "episodes.$.status": target, "episodes.$.updatedAt": now, updatedAt: now } },
  );
  return NextResponse.json({ ok: true, status: target });
}
