/**
 * Rewrites incoming deep links before Expo Router matches them. Better Auth's email links arrive
 * with a trailing slash (`<scheme>://reset-password/?token=…`, `<scheme>://email-changed/?error=…`),
 * so drop a trailing slash after the last path segment; `reset-password` and `reset-password/` both match.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return path.replace(/([^/:])\/+(?=[?#]|$)/, '$1');
  } catch {
    return path;
  }
}
