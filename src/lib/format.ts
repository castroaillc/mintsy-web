import type { Book, Episode, EpisodeProgress } from "./types";

/** 312 → "5:12" */
export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function totalSec(book: Pick<Book, "episodes">) {
  return book.episodes.reduce((sum, e) => sum + (e.durationSec || 0), 0);
}

/** 6060 → "1 hr 41 min", 3000 → "50 min" */
export function runtimeLong(sec: number) {
  const mins = Math.round(sec / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** 6060 → "1h 41m" */
export function runtimeShort(sec: number) {
  const mins = Math.round(sec / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Typical episode length in whole minutes ("5 min each"). */
export function minutesEach(book: Pick<Book, "episodes">) {
  if (!book.episodes.length) return 5;
  return Math.max(1, Math.round(totalSec(book) / book.episodes.length / 60));
}

/** Reading time of an episode's transcript, estimated from its runtime (~150 wpm spoken, ~230 wpm read). */
export function readMinutes(durationSec: number) {
  return Math.max(1, Math.round(durationSec / 150));
}

export function minutesLeft(p: Pick<EpisodeProgress, "positionSec" | "durationSec">) {
  const left = Math.max(0, p.durationSec - p.positionSec);
  return `${Math.max(1, Math.round(left / 60))} min left`;
}

export function pct(n: number) {
  return `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`;
}

/** Share of the series watched: completed episodes count fully, partial ones by position. */
export function seriesFraction(book: Pick<Book, "episodes">, progress: EpisodeProgress[]) {
  if (!book.episodes.length) return 0;
  let sum = 0;
  for (const p of progress) {
    if (p.completed) sum += 1;
    else if (p.durationSec > 0) sum += Math.min(1, p.positionSec / p.durationSec);
  }
  return sum / book.episodes.length;
}

/** "Oct 2026" */
export function monthYear(iso: string | Date | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** "Oct 20" (with the year when it isn't this year) */
export function shortDate(iso: string | Date | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "November 6, 2026" */
export function longDate(iso: string | Date | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** "Premium · Yearly" etc. from a store product id, by its period word (same rule as the app). */
export function planName(productId: string | null | undefined) {
  if (!productId) return null;
  if (/year|annual|12m/i.test(productId)) return "Yearly";
  if (/month|1m/i.test(productId)) return "Monthly";
  return null;
}

export function episodeOf(book: Pick<Book, "episodes">, n: number): Episode | undefined {
  return book.episodes.find((e) => e.number === n);
}
