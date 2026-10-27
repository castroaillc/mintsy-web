import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type Session } from "../auth.js";

export interface Context {
  session: Session | null;
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return { session };
}
