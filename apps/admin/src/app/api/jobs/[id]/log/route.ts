import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { jsonError } from "@/lib/api";
import { readJobLog } from "@/lib/jobs";

/** GET /api/jobs/<id>/log → { log } with every line. Lists leave out finished jobs' logs; the UI fetches one when it shows it. */
export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]/log">) {
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) return jsonError(400, "Not a job id");
  const log = await readJobLog(new ObjectId(id));
  if (!log) return jsonError(404, "Job not found");
  return NextResponse.json({ log });
}
