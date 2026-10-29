import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type Session } from "../auth.js";
import { getPremium, NOT_PREMIUM, type Premium } from "../entitlements.js";

export interface Context {
  session: Session | null;
  /** The viewer's Premium state, loaded at most once per request (signed out = not premium). */
  viewerPremium: () => Promise<Premium>;
  /** Replaces the cached value, e.g. after refreshPremium in the same request. */
  setViewerPremium: (premium: Premium) => void;
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  let premium: Promise<Premium> | null = null;
  return {
    session,
    viewerPremium: () => (premium ??= session ? getPremium(session.user.id) : Promise.resolve(NOT_PREMIUM)),
    setViewerPremium: (value) => {
      premium = Promise.resolve(value);
    },
  };
}
