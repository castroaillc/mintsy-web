import { NextResponse } from "next/server";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { booksCol } from "@/lib/mongo";
import { bulkPublishSchema } from "@/lib/schemas";
import { canPublishEpisodes, formatList } from "@/lib/status";
import type { BookDoc } from "@/lib/types";

/**
 * Only what the publish rule reads, so the route doesn't pull a voiced book's transcript text and
 * captions (about 1 MB) over the remote link. Transcript lines come back as `{ startSec }`, which is all
 * `apiProblems` looks at. `updatedAt` guards the write against a change since the read.
 */
const RULE_PROJECTION = {
  "episodes.number": 1,
  "episodes.status": 1,
  "episodes.updatedAt": 1,
  "episodes.durationSec": 1,
  "episodes.transcript.startSec": 1,
  "episodes.voices.id": 1,
  "episodes.voices.isDefault": 1,
  "episodes.voices.durationSec": 1,
  "episodes.voices.transcript.startSec": 1,
};

/**
 * Publish several episodes in one go. The selection is judged as a whole (`canPublishEpisodes`): each
 * one exists and is a draft, published + selected is a contiguous run from 1, and nothing in the run
 * the app would see has values the API can't serve. Either all of them are published or none is.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/episodes/status">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id } = await ctx.params;
  const parsed = bulkPublishSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const numbers = [...new Set(parsed.data.numbers)].sort((a, b) => a - b);

  const books = await booksCol();
  const book = await books.findOne({ _id: id }, { projection: RULE_PROJECTION });
  if (!book) return jsonError(404, "Book not found");
  const episodes: BookDoc["episodes"] = book.episodes ?? [];

  const check = canPublishEpisodes(episodes, numbers);
  if (!check.ok) return jsonError(409, check.reason);

  // Every episode in the new run must still be as it was read: the selection still drafts, the rest still
  // published, nothing re-rendered or edited in between. Otherwise nothing is written.
  const selected = new Set(numbers);
  const run = episodes.filter((e) => e.number <= numbers[numbers.length - 1]);
  const unchanged = run.map((e) => ({
    episodes: {
      $elemMatch: {
        number: e.number,
        status: selected.has(e.number) ? "draft" : (e.status ?? { $exists: false }),
        updatedAt: e.updatedAt ?? null,
      },
    },
  }));

  const now = new Date();
  const res = await books.updateOne(
    { _id: id, $and: unchanged },
    { $set: { "episodes.$[ep].status": "published", "episodes.$[ep].updatedAt": now, updatedAt: now } },
    { arrayFilters: [{ "ep.number": { $in: numbers } }] },
  );
  if (!res.matchedCount) {
    return jsonError(409, "The book's episodes changed while publishing, so nothing was published. Reload and try again.");
  }
  return NextResponse.json({ ok: true, status: "published", numbers, published: formatList(numbers) });
}
