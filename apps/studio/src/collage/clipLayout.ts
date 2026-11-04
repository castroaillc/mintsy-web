/**
 * Geometry of vertical clips, shared with the pipeline, so it stays free of React and fonts.
 *
 * The safe area is the strictest of the ad templates TikTok, Meta and Google publish for 1080×1920,
 * checked 2026-11-03 through upload-post.com's table and adkit.so. Platforms publish no figures for
 * organic posts, whose interface is usually smaller:
 *   TikTok  top 240, bottom 660, sides 120, plus 300 on the right from y 840 down
 *   Reels   top 269, bottom 672, sides 65
 *   Shorts  top 288, bottom 672, left 48, right 192
 */
export const CLIP_WIDTH = 1080;
export const CLIP_HEIGHT = 1920;

export const CLIP_SAFE = {
  top: 288,
  /** y of the bottom edge: 672 above the end of the frame. */
  bottom: 1248,
  left: 120,
  /** x of the right edge above lowerFrom: 192 from the side of the frame. */
  right: 888,
  /** From here down, TikTok's action buttons take 300 on the right. */
  lowerFrom: 840,
  /** x of the right edge below lowerFrom. */
  lowerRight: 780,
};

/**
 * Where a beat's text goes: inside the safe area by enough to survive the camera's 4% push, and
 * above the tallest caption. Text below `lowerFrom` stays left of `lowerRight`.
 */
export const CLIP_CONTENT = {
  top: 322,
  bottom: 980,
  left: 140,
  right: 868,
  width: 728,
  centerX: 504,
  lowerFrom: 840,
  lowerRight: 765,
};

export const END_CARD_SEC = 3.5;
/** Shortest scenes and longest finished clip, end card included. */
export const CLIP_MIN_SEC = 15;
export const CLIP_MAX_SEC = 60;
export const CLIP_MAX_SCENES = 3;

/** Condensed capitals run about this wide per character, relative to the type size. */
const CHAR_WIDTH = 0.52;

/** The largest type size in [min, max] at which `text` fits `width` within `lines` lines, by estimate. */
export function fitSize(text: string, width: number, { max, min, lines = 1 }: { max: number; min: number; lines?: number }) {
  const longestWord = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  const size = Math.min((width * lines) / (Math.max(text.length, 1) * CHAR_WIDTH * 1.08), width / (longestWord * CHAR_WIDTH));
  return Math.round(Math.max(min, Math.min(max, size)));
}

/** Tallest a caption may be, so it stays between the text zone and the safe area's bottom edge. */
const CAPTION_MAX_HEIGHT = CLIP_SAFE.bottom - CLIP_CONTENT.bottom;
const CAPTION_WIDTH = CLIP_SAFE.lowerRight - CLIP_SAFE.left - 40;
/** Space Grotesk bold runs about this wide per character. */
const CAPTION_CHAR_WIDTH = 0.6;

/** The largest caption size at which a phrase fits above the safe area's bottom edge, wrapping word by word. */
export function captionSize(words: string[]) {
  const sizes = [56, 50, 44, 38];
  const fits = (size: number) => {
    let rows = 1;
    let used = 0;
    for (const word of words) {
      const width = word.length * size * CAPTION_CHAR_WIDTH;
      if (used > 0 && used + 14 + width > CAPTION_WIDTH) {
        rows++;
        used = 0;
      }
      used += (used > 0 ? 14 : 0) + width;
    }
    return rows * size * 1.15 + (rows - 1) * 6 + 32 <= CAPTION_MAX_HEIGHT;
  };
  return sizes.find(fits) ?? sizes[sizes.length - 1];
}
