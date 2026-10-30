import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

export function jsonError(status: number, error: string, issues?: unknown) {
  return NextResponse.json({ error, ...(issues ? { issues } : {}) }, { status });
}

/**
 * The dashboard has no sign-in, so refuse writes from other origins: a web page
 * open in the same browser must not be able to POST to 127.0.0.1.
 * Requests without an Origin header (curl, scripts on this machine) are allowed.
 */
export function rejectCrossOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (host && new URL(origin).host === host) return null;
  } catch {
    // fall through
  }
  return jsonError(403, "Cross-origin request refused");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function zodError(err: z.ZodError) {
  return jsonError(
    400,
    err.issues[0] ? `${err.issues[0].path.join(".") || "body"}: ${err.issues[0].message}` : "Invalid input",
    err.issues.map((i) => ({ path: i.path, message: i.message })),
  );
}

export function parseEpisodeNumber(n: string) {
  const v = Number(n);
  return Number.isInteger(v) && v >= 1 ? v : null;
}
