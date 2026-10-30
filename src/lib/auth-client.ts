"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client. baseURL is this web origin: /api/auth/* is proxied to the API, so the session cookie
 * (`__Secure-better-auth.session_token`, or `better-auth.session_token` over http in dev) is first-party,
 * HttpOnly and host-only.
 */
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
});

export const { useSession } = authClient;

/** Absolute URL on this origin, for callbackURL / redirectTo (Better Auth wants absolute URLs). */
export function absoluteUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}

/** Better Auth error → code string (INVALID_EMAIL_OR_PASSWORD, USER_ALREADY_EXISTS, …). */
export function authErrorCode(error: { code?: string; message?: string; status?: number } | null | undefined) {
  return error?.code ?? (error?.status ? `HTTP_${error.status}` : "UNKNOWN");
}
