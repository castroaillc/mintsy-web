import { NextResponse } from "next/server";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { booksCol } from "@/lib/mongo";
import { statusSchema } from "@/lib/schemas";

/** Publish / unpublish a whole book. Publishing goes live in the app immediately. */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/status">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id } = await ctx.params;
  const parsed = statusSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const res = await (await booksCol()).updateOne(
    { _id: id },
    { $set: { status: parsed.data.status, updatedAt: new Date() } },
  );
  if (!res.matchedCount) return jsonError(404, "Book not found");
  return NextResponse.json({ ok: true, status: parsed.data.status });
}
