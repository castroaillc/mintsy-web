import { NextResponse } from "next/server";
import { jsonError, parseEpisodeNumber, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { booksCol } from "@/lib/mongo";
import { episodeEditSchema } from "@/lib/schemas";

/** Save episode text: title, summary, takeaways, transcript. Doesn't change status or media. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/books/[id]/episodes/[n]">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id, n: nRaw } = await ctx.params;
  const n = parseEpisodeNumber(nRaw);
  if (!n) return jsonError(400, "Episode number must be a positive integer");

  const books = await booksCol();
  const book = await books.findOne({ _id: id });
  const ep = book?.episodes.find((e) => e.number === n);
  if (!book || !ep) return jsonError(404, "Episode not found");

  const parsed = episodeEditSchema(ep.durationSec).safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const v = parsed.data;
  const now = new Date();

  const res = await books.updateOne(
    { _id: id, "episodes.number": n },
    {
      $set: {
        "episodes.$.title": v.title,
        "episodes.$.summary": v.summary,
        "episodes.$.takeaways": v.takeaways,
        "episodes.$.transcript": v.transcript,
        "episodes.$.updatedAt": now,
        updatedAt: now,
      },
    },
  );
  if (!res.matchedCount) return jsonError(404, "Episode not found");
  return NextResponse.json({ ok: true });
}
