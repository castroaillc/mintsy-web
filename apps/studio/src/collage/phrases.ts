/**
 * Caption phrase grouping. Kept free of React, Remotion and fonts, because the pipeline runs it in
 * Node as well: polish.tsx draws these phrases and pipeline/voices.ts stores them as timed text.
 */
export type Word = { text: string; startSec: number; endSec: number };

const MAX_WORDS = 7;

/** Groups words into short caption phrases: break on sentence punctuation, pauses, or length. */
export function phrases(words: Word[]): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const [i, w] of words.entries()) {
    cur.push(w);
    const next = words[i + 1];
    const pause = next ? next.startSec - w.endSec > 0.45 : true;
    const punct = /[.!?;:]["')\]]*$/.test(w.text) || (/,$/.test(w.text) && cur.length >= 4);
    if (!next || pause || punct || cur.length >= MAX_WORDS) {
      out.push(cur);
      cur = [];
    }
  }
  return out;
}
