import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { searchBooks, type SourceId } from "@/lib/book-sources";

const SOURCES: SourceId[] = ["gutenberg", "archive"];

/** GET /api/find?q=...&source=all|gutenberg|archive → { results, errors } */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 2) return jsonError(400, "q: type at least 2 characters");
  const source = params.get("source") ?? "all";
  const sources = source === "all" ? SOURCES : SOURCES.filter((s) => s === source);
  if (sources.length === 0) return jsonError(400, "source: expected all, gutenberg or archive");
  return NextResponse.json(await searchBooks(q, sources));
}
