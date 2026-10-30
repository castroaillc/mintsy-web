import type { ContentStatus, EpisodeDoc } from "./types";

/** Missing status means "published" (docs that predate drafts). */
export function effectiveStatus(s: ContentStatus | undefined): ContentStatus {
  return s ?? "published";
}

type Ep = Pick<EpisodeDoc, "number" | "status">;

export type RuleCheck = { ok: true } | { ok: false; reason: string };

/** Episodes go live only as a contiguous run from 1: n may be published only when 1..n-1 are. */
export function canPublishEpisode(episodes: Ep[], n: number): RuleCheck {
  const ep = episodes.find((e) => e.number === n);
  if (!ep) return { ok: false, reason: `Episode ${n} doesn't exist yet.` };
  if (effectiveStatus(ep.status) === "published") return { ok: false, reason: `Episode ${n} is already published.` };
  const missing: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = episodes.find((e) => e.number === i);
    if (!prev || effectiveStatus(prev.status) !== "published") missing.push(i);
  }
  if (missing.length) {
    return {
      ok: false,
      reason: `Publish episode${missing.length > 1 ? "s" : ""} ${formatList(missing)} first: episodes go live only as a contiguous run from episode 1.`,
    };
  }
  return { ok: true };
}

/** Only the highest published episode may be unpublished. */
export function canUnpublishEpisode(episodes: Ep[], n: number): RuleCheck {
  const ep = episodes.find((e) => e.number === n);
  if (!ep) return { ok: false, reason: `Episode ${n} doesn't exist.` };
  if (effectiveStatus(ep.status) !== "published") return { ok: false, reason: `Episode ${n} is not published.` };
  const highest = Math.max(...episodes.filter((e) => effectiveStatus(e.status) === "published").map((e) => e.number));
  if (highest !== n) {
    return { ok: false, reason: `Unpublish episode ${highest} first: only the highest published episode can be unpublished.` };
  }
  return { ok: true };
}

/** Episodes the app actually shows: the contiguous published run starting at 1. */
export function liveRunLength(episodes: Ep[]): number {
  let n = 0;
  while (episodes.some((e) => e.number === n + 1 && effectiveStatus(e.status) === "published")) n++;
  return n;
}

function formatList(ns: number[]) {
  if (ns.length <= 3) return ns.join(", ");
  return `${ns[0]}–${ns[ns.length - 1]}`;
}
