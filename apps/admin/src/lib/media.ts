import "server-only";
import { env } from "./env";

/** Public URL for a media bucket object, or null when there is no file yet. */
export function mediaUrl(p: string | undefined | null) {
  return p ? `${env.mediaBaseUrl}/${p.replace(/^\/+/, "")}` : null;
}
