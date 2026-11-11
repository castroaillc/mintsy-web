import type { ContentStatus, EpisodeDoc } from "./types";

/** Missing status means "published" (docs that predate drafts). */
export function effectiveStatus(s: ContentStatus | undefined): ContentStatus {
  return s ?? "published";
}

type Ep = Pick<EpisodeDoc, "number" | "status">;

export type RuleCheck = { ok: true } | { ok: false; reason: string };

export type PublicEp = Ep & Pick<EpisodeDoc, "durationSec" | "transcript" | "voices">;

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
  return canPublishEpisodes(episodes, [n]);
}

/**
 * Publishing several episodes at once: the selection is judged as a whole, so 1..k can go together even
 * though each depends on the ones before it. Refused unless every selected episode exists and is a draft,
 * and the published episodes plus the selection form a contiguous run from 1 up to the highest selected.
 * Then the run the app would see is checked for values the API can't serve. Never a partial verdict.
 */
export function canPublishEpisodes(episodes: PublicEp[], numbers: number[]): RuleCheck {
  const selection = checkEpisodeSelection(episodes, numbers);
  if (!selection.ok) return selection;
  const selected = new Set(numbers);
  return checkPublicRun(episodes.map((e) => (selected.has(e.number) ? { ...e, status: "published" as const } : e)));
}

/** The order part of the rule alone, without the API values, so the page can check a selection as it's made. */
export function checkEpisodeSelection(episodes: Ep[], numbers: number[]): RuleCheck {
  const selected = [...new Set(numbers)].sort((a, b) => a - b);
  if (selected.length === 0) return { ok: false, reason: "Select at least one episode." };
  const byNumber = new Map(episodes.map((e) => [e.number, e]));
  const absent = selected.filter((n) => !byNumber.has(n));
  if (absent.length) {
    return { ok: false, reason: `${plural("Episode", absent)} ${formatList(absent)} ${absent.length > 1 ? "don't" : "doesn't"} exist yet.` };
  }
  const published = selected.filter((n) => effectiveStatus(byNumber.get(n)!.status) === "published");
  if (published.length) {
    return { ok: false, reason: `${plural("Episode", published)} ${formatList(published)} ${published.length > 1 ? "are" : "is"} already published.` };
  }
  const chosen = new Set(selected);
  const missing: number[] = [];
  for (let i = 1; i < selected[selected.length - 1]; i++) {
    const ep = byNumber.get(i);
    if (!chosen.has(i) && (!ep || effectiveStatus(ep.status) !== "published")) missing.push(i);
  }
  if (missing.length) {
    const also = selected.length > 1 ? ` or add ${missing.length > 1 ? "them" : "it"} to the selection` : "";
    return {
      ok: false,
      reason: `Publish ${plural("episode", missing)} ${formatList(missing)} first${also}: episodes go live only as a contiguous run from episode 1.`,
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

/** "3", "1, 4", "1–5, 8, 10–12": runs of three or more collapse to a range. */
export function formatList(ns: number[]) {
  const sorted = [...new Set(ns)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(sorted[k]));
    i = j + 1;
  }
  return parts.join(", ");
}

const plural = (word: string, ns: unknown[]) => (ns.length > 1 ? `${word}s` : word);
