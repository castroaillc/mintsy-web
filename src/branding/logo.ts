import { getTheme, logoPaths } from "@mintsy/brand";

const { foreground, brand } = getTheme("ink-coral", "dark");

/** The official mintsy wordmark from @mintsy/brand, with its colors for dark backgrounds. */
export const WORDMARK = {
  ...logoPaths.wordmark,
  /** For dark backgrounds, which the intro always is. */
  onDark: { letters: foreground, dot: brand },
};

const INTSY_START = WORDMARK.letters.indexOf(" M824");

/** The wordmark's letters split for the intro's unfold: drawn together, they are exactly `letters`. */
export const LOGO_M = WORDMARK.letters.slice(0, INTSY_START);
export const LOGO_INTSY = WORDMARK.letters.slice(INTSY_START + 1);

/** Where the letters and the dot sit, in wordmark units. */
export const LOGO_M_END = 718;
export const LOGO_BASELINE = 714;
export const DOT_LEFT = 3136;
export const DOT_CENTER = 3231;
export const DOT_BOTTOM = 728;
/** The dot's left edge in the official "m." mark (logoPaths.mark), where "m" is unchanged. */
export const MARK_DOT_LEFT = 808;
