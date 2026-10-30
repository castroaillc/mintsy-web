import { NextResponse } from "next/server";
import { jsonError, readJson, rejectCrossOrigin, zodError } from "@/lib/api";
import { booksCol } from "@/lib/mongo";
import { bookMetaSchema } from "@/lib/schemas";

/** Update book metadata. Doesn't touch status or episodes. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/books/[id]">) {
  const refused = rejectCrossOrigin(req);
  if (refused) return refused;
  const { id } = await ctx.params;
  const parsed = bookMetaSchema.safeParse(await readJson(req));
  if (!parsed.success) return zodError(parsed.error);

  const res = await (await booksCol()).updateOne({ _id: id }, { $set: { ...parsed.data, updatedAt: new Date() } });
  if (!res.matchedCount) return jsonError(404, "Book not found");
  return NextResponse.json({ ok: true });
}
