import "server-only";

/**
 * Where the mintsy API runs. The browser never calls it directly: /api/auth/* and /graphql on this origin are
 * proxied to it (src/app/api/auth/[...path]/route.ts, src/app/graphql/route.ts).
 */
export function apiOrigin() {
  const fromEnv = process.env.API_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return process.env.NODE_ENV === "production" ? "https://api.getmintsy.com" : "http://localhost:4000";
}
