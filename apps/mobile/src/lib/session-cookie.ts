/**
 * Reading the Better Auth cookie jar that `@better-auth/expo` keeps on the device. No imports, so
 * scripts/launch.test.mjs can check it under plain Node.
 *
 * The plugin stores every cookie the API set as JSON under `<storagePrefix>_cookie` (`mintsy_cookie`):
 * `{ "better-auth.session_token": { "value": "…", "expires": "2026-11-12T…Z" | null }, … }`. It drops expired entries
 * when building the `Cookie` header, so a jar without a live `session_token` sends no session, and the API can only
 * answer "signed out".
 */

/** True when the stored cookie jar holds a session token that hasn't expired. */
export function hasSessionCookie(jar: string | null | undefined, now = Date.now()): boolean {
  if (!jar) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jar);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== 'object') return false;
  return Object.entries(parsed as Record<string, unknown>).some(([name, cookie]) => {
    if (!name.includes('session_token') || !cookie || typeof cookie !== 'object') return false;
    const { value, expires } = cookie as { value?: unknown; expires?: unknown };
    if (typeof value !== 'string' || value === '') return false;
    if (typeof expires !== 'string') return true;
    const expiresAt = new Date(expires).getTime();
    return Number.isNaN(expiresAt) || expiresAt > now;
  });
}
