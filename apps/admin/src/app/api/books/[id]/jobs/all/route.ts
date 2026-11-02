import { NextResponse } from "next/server";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { buildJobs, summarizePlan, type PlannedChapter } from "@/lib/generate-all";
import { loadPlan } from "@/lib/generate-all-plan";
import { cancelQueuedJobs, insertJobs, listLiveWorkers, outdatedWorkerError } from "@/lib/jobs";
import { booksCol } from "@/lib/mongo";
import { generateAllSchema } from "@/lib/schemas";

async function bookExists(bookId: string) {
  return !!(await (await booksCol()).findOne({ _id: bookId }, { projection: { _id: 1 } }));
}

/** Why jobs can't be queued now. With no live worker the preview capability can't be checked. */
async function workerProblem() {
  const workers = await listLiveWorkers();
  if (workers.length === 0) return { dryRun: false, problem: "No studio worker is running. Start one with pnpm dev:studio, then try again." };
  return { dryRun: workers.every((w) => w.dryRun), problem: await outdatedWorkerError("render-preview") };
}

function skippedList(plan: PlannedChapter[]) {
  return plan.flatMap((c) => (c.skip ? [{ chapter: c.number, title: c.title, reason: c.skip }] : []));
}

/** The plan, for the confirmation dialog. Queues nothing. */
export async function GET(_req: Request, ctx: RouteContext<"/api/books/[id]/jobs/all">) {
  const { id: bookId } = await ctx.params;
  if (!(await bookExists(bookId))) return jsonError(404, "Book not found (has the ingest finished?)");
  const [chapters, worker] = await Promise.all([loadPlan(bookId), workerProblem()]);
  return NextResponse.json({ chapters, workerDryRun: worker.dryRun, workerProblem: worker.problem });
}

/** Two requests planning at once would both queue the same paid script jobs. */
const queueing = new Set<string>();

/** Queues the script and preview render jobs the book still needs. Optional `chapters` limits it to those numbers. */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/jobs/all">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id: bookId } = await ctx.params;
  const parsed = generateAllSchema.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return zodError(parsed.error);

  if (!(await bookExists(bookId))) return jsonError(404, "Book not found (has the ingest finished?)");
  const { problem } = await workerProblem();
  if (problem) return jsonError(409, problem);

  if (queueing.has(bookId)) return jsonError(409, "This book's jobs are being queued already");
  queueing.add(bookId);
  try {
    const plan = await loadPlan(bookId, parsed.data.chapters);
    const known = new Set(plan.map((c) => c.number));
    const unknown = parsed.data.chapters?.find((n) => !known.has(n));
    if (unknown !== undefined) return jsonError(400, `Chapter ${unknown} isn't in this book`);

    // Unlike the single-chapter route, a render doesn't need a finished script here: its script job is queued just ahead of it.
    const docs = buildJobs(bookId, plan, Date.now());
    const ids = await insertJobs(docs);
    const { scripts, renders } = summarizePlan(plan);
    return NextResponse.json(
      {
        queued: docs.length,
        scripts,
        renders,
        jobs: docs.map((d, i) => ({ id: ids[i], kind: d.kind, chapter: d.chapter, ...(d.preview ? { preview: true } : {}), createdAt: d.createdAt.toISOString() })),
        skipped: skippedList(plan),
      },
      { status: docs.length ? 201 : 200 },
    );
  } finally {
    queueing.delete(bookId);
  }
}

/** Cancels the book's queued jobs. A running job finishes; finished jobs stay. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/books/[id]/jobs/all">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id: bookId } = await ctx.params;
  if (!(await bookExists(bookId))) return jsonError(404, "Book not found (has the ingest finished?)");
  return NextResponse.json({ deleted: await cancelQueuedJobs(bookId) });
}
