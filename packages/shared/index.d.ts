/** Episodes 1..FREE_EPISODES of every book are free; later ones need Premium. */
export declare const FREE_EPISODES: 3;

/** The categories the app can filter by. A book in any other category never matches a chip. */
export declare const CATEGORIES: readonly ["Finance", "Business", "Psychology", "Productivity", "History", "Health"];
export type Category = (typeof CATEGORIES)[number];
export declare function isCategory(value: string): value is Category;

export interface TranscriptLine {
  startSec: number;
  text: string;
}

/** Missing means "published" (docs that predate drafts). */
export type ContentStatus = "draft" | "published";

/** One timed caption phrase, on its voice's own timeline. Seconds may be fractional. */
export interface CaptionPhrase {
  startSec: number;
  endSec: number;
  text: string;
}

/** One full render of an episode by a single narrator. */
export interface EpisodeVoiceDoc {
  /** Voice id, e.g. "af_heart". */
  id: string;
  name: string;
  isDefault: boolean;
  /** Object path in the media bucket. */
  videoPath: string;
  /** HLS master playlist in the media bucket, like `EpisodeDoc.hlsPath`. */
  hlsPath?: string;
  /** Whole seconds. */
  durationSec: number;
  transcript: TranscriptLine[];
  captions: CaptionPhrase[];
}

/** One episode embedded in a `books` document (database `mintsy_studio`). */
export interface EpisodeDoc {
  number: number;
  title: string;
  summary: string;
  durationSec: number;
  transcript: TranscriptLine[];
  takeaways: string[];
  /** Object path in the media bucket. */
  videoPath?: string;
  /** HLS master playlist, `books/<bookId>/<chapter>-<hash>/master.m3u8`. */
  hlsPath?: string;
  thumbnailPath?: string;
  /** One full render per narrator. Missing on episodes without voices. */
  voices?: EpisodeVoiceDoc[];
  status?: ContentStatus;
  updatedAt?: Date;
}

/** A document in `books` (database `mintsy_studio`). */
export interface BookDoc {
  _id: string;
  title: string;
  author: string;
  category: string;
  coverTone: string;
  tint: string;
  description: string;
  /** Rendered cover in the media bucket. Apps draw a cover when it's missing. */
  coverPath?: string;
  /** Position in the catalog listing. */
  order: number;
  episodes: EpisodeDoc[];
  status?: ContentStatus;
  updatedAt?: Date;
}
