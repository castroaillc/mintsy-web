import { Storage } from "@google-cloud/storage";
import { mediaUrl } from "./catalog.js";
import { env } from "./env.js";

/**
 * URLs for objects in the media bucket.
 *
 * SIGNED_MEDIA off (default): MEDIA_BASE_URL + path (public bucket).
 * SIGNED_MEDIA on: GCS V4 signed read URLs (private bucket). On Cloud Run there's no key file, so
 * the library signs through the IAM Credentials signBlob API as the runtime service account, which
 * needs roles/iam.serviceAccountTokenCreator on itself (see README).
 *
 * Signed URLs are aligned to fixed time windows (accessibleAt = window start) so the same object
 * gets the same URL for the whole window. That keeps client image/video caches useful and lets us
 * memoize, so a books query doesn't make one signBlob call per episode on every request.
 */
const MIN = 60_000;

/** Video: new URL every 30 min, valid 90 min from the window start → always 60–90 min left. */
const VIDEO = { windowMs: 30 * MIN, ttlMs: 90 * MIN };
/** Thumbnail: new URL daily, valid 7 days (V4 maximum) → always 6–7 days left. */
const THUMB = { windowMs: 24 * 60 * MIN, ttlMs: 7 * 24 * 60 * MIN };

let storage: Storage | null = null;
/** key = `${windowStart}:${path}`; an entry is dead once its window has passed. */
const cache = new Map<string, { windowEnd: number; url: Promise<string> }>();

function sign(path: string, { windowMs, ttlMs }: { windowMs: number; ttlMs: number }) {
  const now = Date.now();
  const start = Math.floor(now / windowMs) * windowMs;
  const key = `${start}:${path}`;
  const hit = cache.get(key);
  if (hit) return hit.url;

  storage ??= new Storage();
  const url = storage
    .bucket(env.mediaBucket)
    .file(path)
    .getSignedUrl({ version: "v4", action: "read", accessibleAt: start, expires: start + ttlMs })
    .then(([u]) => u);
  cache.set(key, { windowEnd: start + windowMs, url });
  url.catch(() => cache.delete(key)); // don't cache failures

  if (cache.size > 5000) {
    for (const [k, v] of cache) if (v.windowEnd <= now) cache.delete(k);
  }
  return url;
}

async function signedOrNull(path: string, kind: typeof VIDEO) {
  try {
    return await sign(path, kind);
  } catch (err) {
    console.error(`Signing ${path} failed:`, (err as Error).message);
    return null;
  }
}

/** URL to stream an episode video. Callers must only ask for episodes the viewer may watch. */
export async function videoUrl(path: string | undefined) {
  if (!path) return null;
  return env.signedMedia ? signedOrNull(path, VIDEO) : mediaUrl(path);
}

export async function thumbnailUrl(path: string | undefined) {
  if (!path) return null;
  return env.signedMedia ? signedOrNull(path, THUMB) : mediaUrl(path);
}
