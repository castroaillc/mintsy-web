import { NextResponse } from "next/server";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { hasActiveJob, insertJob } from "@/lib/jobs";
import { booksCol, jobsCol } from "@/lib/mongo";
import { createJobSchema } from "@/lib/schemas";

/** Queue a `script` or `render` job for one chapter. */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/jobs">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id: bookId } = await ctx.params;
  const parsed = createJobSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);
  const body = parsed.data;

  const book = await (await booksCol()).findOne({ _id: bookId }, { projection: { _id: 1 } });
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
    ...(body.scriptJson !== undefined ? { scriptJson: body.scriptJson } : {}),
    ...(body.scenesJson !== undefined ? { scenesJson: body.scenesJson } : {}),
  });
  return NextResponse.json({ jobId }, { status: 201 });
}
