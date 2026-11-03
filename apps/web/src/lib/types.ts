/**
 * Catalog and viewer types. Shapes follow the GraphQL schema (backend/src/graphql/schema.ts) and the
 * iPhone app's types (mobile-app/src/data/types.ts). Tones are cover/thumbnail art colours, not theme colours.
 */

import { themes } from "@mintsy/brand";
import { CATEGORIES, type Category, type TranscriptLine } from "@mintsy/shared";

export { CATEGORIES, FREE_EPISODES } from "@mintsy/shared";
export type { Category, TranscriptLine };

export type Episode = {
  /** `<bookId>-<number>` */
  id: string;
  number: number;
  title: string;
  summary: string;
  durationSec: number;
  /** Empty when locked, and in catalog lists (only the single-book query asks for it). */
  transcript?: TranscriptLine[];
  /** Empty when locked. */
  takeaways?: string[];
  /** Progressive MP4; null until uploaded and null when locked. May be a short-lived signed URL: refetch it. */
  videoUrl?: string | null;
  thumbnailUrl: string | null;
  /** True when the viewer needs Premium to watch (number > FREE_EPISODES and not Premium). */
  locked: boolean;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  category: Category | string;
  /** Solid background of the generated cover tile. */
  coverTone: string;
  /** Rendered cover image (2:3), null until one is published; the tile is drawn without it. */
  coverUrl?: string | null;
  /** Darker tint for hero backdrops and the player panel. */
  tint: string;
  description: string;
  episodes: Episode[];
  /** "The book in 5 ideas" (at most 5; may be empty). Only on the single-book query. */
  keyIdeas?: string[];
};

/** A transcript match from `search` (EpisodeMatch in the API). */
export type EpisodeMatch = {
  /** `<bookId>-<number>-<startSec>` */
  id: string;
  bookId: string;
  bookTitle: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  episode: Pick<Episode, "id" | "number" | "title" | "durationSec" | "thumbnailUrl" | "locked">;
  startSec: number;
  snippet: string;
  /** UTF-16 offsets: snippet.slice(matchStart, matchStart + matchLength) is the match. */
  matchStart: number;
  matchLength: number;
};

export type SearchResult = { books: Book[]; episodes: EpisodeMatch[] };

export type Premium = {
  active: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  /** trial | normal | intro */
  periodType: string | null;
  productId: string | null;
  /** app_store | rc_billing (web) | stripe | play_store | promotional | null */
  store: string | null;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  premium: Premium;
  savedBookIds: string[];
  savedEpisodeIds: string[];
};

/** The viewer's place in one episode (API `EpisodeProgress`). */
export type EpisodeProgress = {
  /** `<bookId>-<number>` */
  episodeId: string;
  bookId: string;
  episodeNumber: number;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  /** ISO 8601 */
  updatedAt: string;
  episode?: Pick<Episode, "id" | "number" | "title" | "durationSec" | "thumbnailUrl" | "locked"> | null;
};

export type SavedKind = "BOOK" | "EPISODE";

export const CATEGORY_FILTERS = ["All", ...CATEGORIES] as const;
export type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

/** Rotating thumbnail tints for episode cards (same as the app and the boards). */
export const EPISODE_TINTS: string[] = themes["ink-coral"].tints;

/** Dark or light cover ink, whichever reads on the given tone. */
export function coverInk(tone: string) {
  const n = parseInt(tone.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return "#F4EFE6";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 150 ? "#1C1C1C" : "#F4EFE6";
}
