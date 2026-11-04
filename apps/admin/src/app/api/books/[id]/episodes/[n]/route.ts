import { NextResponse } from "next/server";
import { jsonError, parseEpisodeNumber, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { booksCol } from "@/lib/mongo";
import { episodeBaseSchema, episodeEditSchema, sameTranscript } from "@/lib/schemas";

/**
 * Save episode text: title, summary, takeaways, transcript. Doesn't change status or media.
 * On an episode with voices, a transcript edit also goes to the default voice's copy, which must match
 * the top-level one. The other voices and every voice's captions are never touched.
 * Every save names the `updatedAt` its form loaded with, so a form left open across a render or a
 * remaster can't write its old text and timings over the new ones.
 */
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

  const body = await readJson(req);
  const base = episodeBaseSchema.safeParse(body);
  if (!base.success) return zodError(base.error);
  const changed = () => jsonError(409, "This episode changed while saving (a render or another edit). Reload the page and make the edit again.");
  if (base.data.baseUpdatedAt !== (ep.updatedAt?.toISOString() ?? null)) return changed();

  const voices = ep.voices ?? [];
  const storedTranscript = ep.transcript ?? [];
  const defaults = voices.filter((v) => v.isDefault);
  const defaultVoice = defaults.length === 1 ? defaults[0] : null;

  const parsed = episodeEditSchema({
    durationSec: ep.durationSec,
    storedTranscript,
    voiceLineCount: voices.length ? (defaultVoice?.transcript.length ?? storedTranscript.length) : null,
  }).safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const v = parsed.data;

  // An untouched transcript isn't written, so a title edit leaves times and voices exactly as they are.
  const transcriptChanged = !sameTranscript(v.transcript, storedTranscript);
  if (transcriptChanged && voices.length && !defaultVoice) {
    return jsonError(409, `Episode ${n} has ${defaults.length} default voices instead of one, so its transcript can't be saved. Remaster it to repair the voices.`);
  }
  const editsVoice = transcriptChanged && !!defaultVoice;
  const now = new Date();

  // One document update, so the top-level transcript App Store builds read and the default voice's copy
  // change together. Matching updatedAt refuses a write based on what a render replaced after the read above.
  const res = await books.updateOne(
    { _id: id, episodes: { $elemMatch: { number: n, updatedAt: ep.updatedAt ?? null } } },
    {
      $set: {
        "episodes.$[ep].title": v.title,
        "episodes.$[ep].summary": v.summary,
        "episodes.$[ep].takeaways": v.takeaways,
        ...(transcriptChanged ? { "episodes.$[ep].transcript": v.transcript } : {}),
        ...(editsVoice ? { "episodes.$[ep].voices.$[voice].transcript": v.transcript } : {}),
        "episodes.$[ep].updatedAt": now,
        updatedAt: now,
      },
    },
    { arrayFilters: [{ "ep.number": n }, ...(editsVoice ? [{ "voice.id": defaultVoice.id, "voice.isDefault": true }] : [])] },
  );
  if (!res.matchedCount) return changed();
  return NextResponse.json({ ok: true });
}
