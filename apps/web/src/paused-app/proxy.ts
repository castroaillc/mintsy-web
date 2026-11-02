import { NextResponse, type NextRequest } from "next/server";

/**
 * Signed-out visitors to pages that need an account go to /welcome (Home) or /sign-in?next=… (the rest).
 * This only checks that a session cookie exists; the client re-checks the session itself, so a stale cookie
 * just lands on /welcome after one round trip. Public pages (series pages, search, categories, auth) aren't
 * matched here.
 */
const SESSION_COOKIES = ["__Secure-better-auth.session_token", "better-auth.session_token"];

export function proxy(request: NextRequest) {
  const signedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (signedIn) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname === "/") return NextResponse.redirect(new URL("/welcome", request.url));

  const target = new URL("/sign-in", request.url);
  target.searchParams.set("next", pathname + search);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: [
    "/",
    "/my-list",
    "/profile/:path*",
    "/onboarding/:path*",
    "/premium/:path*",
    // Player, transcript and series-complete pages (the series page /book/[id] itself is public)
    "/book/:id/:rest+",
  ],
};
