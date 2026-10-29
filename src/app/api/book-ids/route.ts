import { NextResponse } from "next/server";
import { bookIdTaken } from "@/lib/catalog";
import { bookIdSchema } from "@/lib/schemas";

/** GET /api/book-ids?id=foo → { ok, error? } for live validation in the New book form. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("id") ?? "";
  const parsed = bookIdSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message });
  const taken = await bookIdTaken(parsed.data);
  return NextResponse.json(taken ? { ok: false, error: taken } : { ok: true });
}
