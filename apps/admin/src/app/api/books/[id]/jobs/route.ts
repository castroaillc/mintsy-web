import { NextResponse } from "next/server";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { hasActiveJob, insertJob, outdatedWorkerError } from "@/lib/jobs";
import { booksCol, jobsCol } from "@/lib/mongo";
import { transcriptRefusal } from "@/lib/remaster";
import { createJobSchema } from "@/lib/schemas";
import { getLocalPreview } from "@/lib/studio-work";

/** Queue a `script`, `render` (optionally preview-only), `upload`, `remaster` or `clip` job for one chapter. */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/jobs">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id: bookId } = await ctx.params;
  const parsed = createJobSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const body = parsed.data;

  const book = await (await booksCol()).findOne({ _id: bookId }, { projection: { _id: 1, episodes: 1 } });
  if (!book) return jsonError(404, "Book not found (has the ingest finished?)");
  if (await hasActiveJob(bookId, body.chapter)) {
    return jsonError(409, `Chapter ${body.chapter} already has a queued or running job`);
  }

  if (body.kind === "script") {
    const jobId = await insertJob({
      kind: "script",
      bookId,
      chapter: body.chapter,
      ...(body.regenerate ? { regenerate: true } : {}),
    });
    return NextResponse.json({ jobId }, { status: 201 });
  }

  const needs =
    body.kind === "upload" || body.kind === "remaster" || body.kind === "clip" ? body.kind : body.kind === "render" && body.preview ? "render-preview" : null;
  const outdated = needs ? await outdatedWorkerError(needs) : null;
  if (outdated) return jsonError(409, outdated);

  if (body.kind === "upload") {
    const preview = await getLocalPreview(bookId, body.chapter);
    if (!preview.video) return jsonError(409, `Chapter ${body.chapter} has no local render yet: render a preview first`);
    const jobId = await insertJob({ kind: "upload", bookId, chapter: body.chapter });
    return NextResponse.json({ jobId }, { status: 201 });
  }

  if (body.kind === "remaster") {
    const episode = book.episodes.find((e) => e.number === body.chapter);
    if (!episode) return jsonError(409, `Chapter ${body.chapter} has no episode to remaster: a remaster only replaces an existing episode`);
    if (body.overwriteTranscript) {
      // Staff must have seen which lines this discards, and they can't have changed since.
      const last = await (await jobsCol()).findOne({ bookId, chapter: body.chapter, kind: "remaster" }, { sort: { createdAt: -1, _id: -1 } });
      if (!last || !transcriptRefusal(last, episode.updatedAt)) {
        return jsonError(409, `overwriteTranscript is only accepted straight after a remaster of chapter ${body.chapter} refused on transcript differences, with no edit since. Queue a normal remaster first.`);
      }
    }
    const jobId = await insertJob({
      kind: "remaster",
      bookId,
      chapter: body.chapter,
      ...(body.overwriteTranscript ? { overwriteTranscript: true } : {}),
    });
    return NextResponse.json({ jobId }, { status: 201 });
  }

  if (body.kind === "clip") {
    const jobId = await insertJob({
      kind: "clip",
      bookId,
      chapter: body.chapter,
      ...(body.voice !== undefined ? { voice: body.voice } : {}),
      ...(body.startScene !== undefined ? { startScene: body.startScene } : {}),
      ...(body.endScene !== undefined ? { endScene: body.endScene } : {}),
    });
    return NextResponse.json({ jobId }, { status: 201 });
  }

  // render: only after a script exists for this chapter
  const script = await (await jobsCol()).findOne(
    { bookId, chapter: body.chapter, kind: "script", status: "succeeded" },
    { projection: { _id: 1 } },
  );
  if (!script) return jsonError(409, `Chapter ${body.chapter} has no generated script yet`);
  const jobId = await insertJob({
    kind: "render",
    bookId,
    chapter: body.chapter,
    ...(body.preview ? { preview: true } : {}),
    ...(body.scriptJson !== undefined ? { scriptJson: body.scriptJson } : {}),
    ...(body.scenesJson !== undefined ? { scenesJson: body.scenesJson } : {}),
  });
  return NextResponse.json({ jobId }, { status: 201 });
}
