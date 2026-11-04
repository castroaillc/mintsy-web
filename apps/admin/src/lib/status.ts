import type { ContentStatus, EpisodeDoc } from "./types";

/** Missing status means "published" (docs that predate drafts). */
export function effectiveStatus(s: ContentStatus | undefined): ContentStatus {
  return s ?? "published";
}

type Ep = Pick<EpisodeDoc, "number" | "status">;

export type RuleCheck = { ok: true } | { ok: false; reason: string };

type PublicEp = Ep & Pick<EpisodeDoc, "durationSec" | "transcript" | "voices">;

const INT_MAX = 2147483647;
const isApiInt = (v: unknown) => Number.isInteger(v) && Math.abs(v as number) <= INT_MAX;
const show = (v: unknown) => (v === undefined ? "missing" : JSON.stringify(v));
const SHOWN_PROBLEMS = 3;

/** Values the API can't serve: durationSec and startSec are Int!, on episodes and on voices. */
function apiProblems(ep: PublicEp) {
  const problems: string[] = [];
  if (!isApiInt(ep.durationSec)) problems.push(`durationSec is ${show(ep.durationSec)}`);
  (ep.transcript ?? []).forEach((l, i) => {
    if (!isApiInt(l.startSec)) problems.push(`transcript line ${i + 1} startSec is ${show(l.startSec)}`);
  });
  const voices = ep.voices ?? [];
  const defaults = voices.filter((v) => v.isDefault).length;
  if (voices.length > 0 && defaults !== 1) problems.push(`it has ${defaults} default voices instead of exactly one`);
  for (const v of voices) {
    if (!isApiInt(v.durationSec)) problems.push(`voice ${v.id} durationSec is ${show(v.durationSec)}`);
    (v.transcript ?? []).forEach((l, i) => {
      if (!isApiInt(l.startSec)) problems.push(`voice ${v.id} transcript line ${i + 1} startSec is ${show(l.startSec)}`);
    });
  }
  return problems;
}

/**
 * Checks what the app would see: every episode in the contiguous published run, not only the one being
 * published, because closing a gap also exposes later episodes already marked published, and publishing
 * a book exposes its whole run. One bad value on a public episode loses the app's whole `books` query.
 */
function checkPublicRun(episodes: PublicEp[]): RuleCheck {
  const bad: string[] = [];
  const count = liveRunLength(episodes);
  for (let n = 1; n <= count; n++) {
    const ep = episodes.find((e) => e.number === n && effectiveStatus(e.status) === "published") as PublicEp;
    const problems = apiProblems(ep);
    if (problems.length === 0) continue;
    const more = problems.length > SHOWN_PROBLEMS ? `; and ${problems.length - SHOWN_PROBLEMS} more` : "";
    bad.push(`Episode ${n}: ${problems.slice(0, SHOWN_PROBLEMS).join("; ")}${more}.`);
  }
  if (bad.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `Can't go public, because these values would make the app's whole catalog fail to load. ${bad.join(" ")} Round transcript times in the episode editor; a duration, another voice's times or the default voice need a remaster.`,
  };
}

/** Publishing a book exposes its published run. */
export function canPublishBook(episodes: PublicEp[]): RuleCheck {
  return checkPublicRun(episodes);
}

/** Episodes go live only as a contiguous run from 1: n may be published only when 1..n-1 are. */
export function canPublishEpisode(episodes: PublicEp[], n: number): RuleCheck {
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
  return checkPublicRun(episodes.map((e) => (e.number === n ? { ...e, status: "published" as const } : e)));
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
