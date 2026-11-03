/** Catalog types and client-side constants. The catalog itself comes from the backend (`src/lib/catalog.tsx`). Tones are cover/thumbnail art colors, not theme colors. */

export type TranscriptLine = { startSec: number; text: string };

export type Episode = {
  id: string;
  number: number;
  title: string;
  summary: string;
  durationSec: number;
  transcript: TranscriptLine[];
  takeaways: string[];
  /** Progressive MP4; null until the episode's video is uploaded. */
  videoUrl: string | null;
  /**
   * HLS playlist (`master.m3u8`), only queried when EXPO_PUBLIC_HLS_ENABLED is on (`src/lib/stream-source.ts`).
   * Null or missing when locked, when the episode has no HLS, and from backends without the field. Never downloaded.
   */
  hlsUrl?: string | null;
  thumbnailUrl: string | null;
  /**
   * From the API: true when the viewer can't watch this episode (free tier, number > FREE_EPISODES).
   * Locked episodes come back with no videoUrl, transcript or takeaways. Missing on older backends.
   */
  locked?: boolean;
};

/** A transcript match from `search` (EpisodeMatch in the API). */
export type EpisodeMatch = {
  /** `<bookId>-<number>-<startSec>` */
  id: string;
  bookId: string;
  bookTitle: string;
  /** `<bookId>-<number>` */
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  episode: Pick<Episode, 'id' | 'number' | 'title' | 'durationSec' | 'thumbnailUrl'> & { locked?: boolean };
  /** Where the player should start. */
  startSec: number;
  /** ~80–120 characters, with … where it was cut. */
  snippet: string;
  /** UTF-16 offsets: snippet.slice(matchStart, matchStart + matchLength) is the match. */
  matchStart: number;
  matchLength: number;
};

export type Category = 'Finance' | 'Business' | 'Psychology' | 'Productivity' | 'History' | 'Health';

export type Book = {
  id: string;
  title: string;
  author: string;
  category: Category;
  /** Solid background of the generated cover tile. */
  coverTone: string;
  /** Rendered cover image (2:3); null/missing until one is published (older backends don't have the field). The tile is drawn without it. */
  coverUrl?: string | null;
  /** Darker tint for hero backdrops and the player panel. */
  tint: string;
  description: string;
  episodes: Episode[];
  /**
   * "The book in 5 ideas" (at most 5; may be empty). Not part of the catalog query: Series complete fetches it
   * on its own so the catalog keeps working against backends that don't have the field yet.
   */
  keyIdeas?: string[];
};

/** Episodes 1…FREE_EPISODES of every book are free; the rest need Premium. Mirrors the backend's constant. */
export const FREE_EPISODES = 3;

/** The viewer's place in one episode (the API's `EpisodeProgress`, trimmed to what the UI needs). */
export type EpisodeProgress = {
  positionSec: number;
  completed: boolean;
  /** ISO 8601; when this was last saved (server time once synced, device time for changes not sent yet). */
  updatedAt?: string;
};
/** Keyed by episode id (`<bookId>-<number>`). */
export type ProgressMap = Record<string, EpisodeProgress>;

export const CATEGORIES = ['All', 'Finance', 'Business', 'Psychology', 'Productivity', 'History', 'Health'] as const;
export type CategoryFilter = (typeof CATEGORIES)[number];

/** Rotating thumbnail tints for episode cards. */
export const EPISODE_TINTS = ['#2B2850', '#2C3245', '#3F2A30', '#3A2B30'];

/** Dark or light cover ink, whichever reads on the given tone. */
export function coverInk(tone: string) {
  const n = parseInt(tone.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 150 ? '#1C1C1C' : '#F4EFE6';
}
