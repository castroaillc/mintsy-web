import type { CaptionPhrase, EpisodeVoice, TranscriptLine } from '@/data/types';

/**
 * Narrator logic with no React Native imports (type-only imports aside), so scripts/voices.test.mjs can run it under
 * plain Node. An episode can have one full render per voice, each on its own timeline. `Episode.videoUrl`, `durationSec`
 * and `transcript` describe the default voice, and saved progress always stays on the default voice's timeline.
 */

// ── API ─────────────────────────────────────────────────────────────

/**
 * Deliberately separate from the catalog query: the timed text is heavy, and an API without `episodeVoices` fails this
 * request alone. `hlsUrl` needs no build flag here, unlike `Episode.hlsUrl`: `EpisodeVoice` has had the field since it
 * first existed. EXPO_PUBLIC_HLS_ENABLED still decides whether it's used (`streamSources`).
 */
export const EPISODE_VOICES_QUERY = `#graphql
  query EpisodeVoices($episodeId: ID!) {
    episodeVoices(episodeId: $episodeId) {
      id
      name
      isDefault
      videoUrl
      hlsUrl
      durationSec
      transcript { startSec text }
      captions { startSec endSec text }
    }
  }
`;

type GraphQLRequest = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

/**
 * The episode's voices, cleaned up. Null when the request failed or timed out (an API without the query, offline, a
 * slow connection). `[]` is an answer: locked, not public, unknown or legacy. Never rejects, so nothing a caller does
 * can be broken by this query.
 */
export async function fetchEpisodeVoices(
  request: GraphQLRequest,
  episodeId: string,
  timeoutMs: number,
): Promise<EpisodeVoice[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('episodeVoices timed out')), timeoutMs);
    });
    const data = await Promise.race([
      request<{ episodeVoices?: unknown }>(EPISODE_VOICES_QUERY, { episodeId }),
      timeout,
    ]);
    return normalizeVoices(data?.episodeVoices);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function normalizeTranscript(lines: unknown): TranscriptLine[] {
  if (!Array.isArray(lines)) return [];
  return lines.filter((l) => isNumber(l?.startSec) && typeof l?.text === 'string');
}

/**
 * Phrases ready for `activeCaption`: in time order, without the zero-length ones the validator allows (they would
 * flash) or empty ones. Text is untouched: phrases keep narration punctuation, and a quote can span two of them.
 */
export function normalizeCaptions(phrases: unknown): CaptionPhrase[] {
  if (!Array.isArray(phrases)) return [];
  return phrases
    .filter(
      (p) =>
        isNumber(p?.startSec) &&
        isNumber(p?.endSec) &&
        p.endSec > p.startSec &&
        typeof p?.text === 'string' &&
        p.text.trim() !== '',
    )
    .sort((a, b) => a.startSec - b.startSec);
}

/** Null if it isn't a list. Bad entries are dropped; with no default voice left, it's handled as a legacy episode. */
export function normalizeVoices(raw: unknown): EpisodeVoice[] | null {
  if (!Array.isArray(raw)) return null;
  const voices: EpisodeVoice[] = raw
    .filter((v) => typeof v?.id === 'string' && typeof v?.name === 'string' && isNumber(v?.durationSec))
    .map((v) => ({
      id: v.id,
      name: v.name,
      isDefault: v.isDefault === true,
      videoUrl: typeof v.videoUrl === 'string' ? v.videoUrl : null,
      hlsUrl: typeof v.hlsUrl === 'string' ? v.hlsUrl : null,
      durationSec: v.durationSec,
      transcript: normalizeTranscript(v.transcript),
      captions: normalizeCaptions(v.captions),
    }));
  return voices.some((v) => v.isDefault) ? voices : [];
}

// ── Choosing a voice ────────────────────────────────────────────────

/** Whether a voice can be streamed. A voice's URLs are null when signing failed, and those can't be offered. */
export function isPlayableVoice(voice: Pick<EpisodeVoice, 'videoUrl' | 'hlsUrl'>, hlsEnabled: boolean) {
  return !!voice.videoUrl || (hlsEnabled && !!voice.hlsUrl);
}

/** The stored preference when this episode offers it, else the episode's default, else null (play the catalog's source). */
export function chooseVoice(voices: EpisodeVoice[], preferredId: string | null, hlsEnabled: boolean) {
  const playable = voices.filter((v) => isPlayableVoice(v, hlsEnabled));
  return playable.find((v) => v.id === preferredId) ?? playable.find((v) => v.isDefault) ?? null;
}

export type KnownVoice = { id: string; name: string };

/** There's no API for every narrator, so Settings offers the ones seen on this device. Most recent first, and capped: it's stored in SecureStore. */
export function mergeKnownVoices(known: KnownVoice[], seen: KnownVoice[]): KnownVoice[] {
  const fresh = seen.map(({ id, name }) => ({ id, name }));
  const rest = known.filter((k) => !fresh.some((v) => v.id === k.id));
  return [...fresh, ...rest].slice(0, 12);
}

// ── Timelines ───────────────────────────────────────────────────────

export type Timeline = { lineStarts: number[]; durationSec: number };

export function timelineOf(source: { transcript: TranscriptLine[]; durationSec: number }): Timeline {
  return { lineStarts: source.transcript.map((l) => l.startSec), durationSec: source.durationSec };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Line starts are whole seconds, so neighbours can be equal, but they must not run backwards. */
const isUsable = (starts: number[]) => starts.every((s, i) => isNumber(s) && s >= 0 && (i === 0 || s >= starts[i - 1]));

/** Whether two timelines can be matched line by line. Studio guarantees equal counts, but nothing here relies on it. */
function linesMatch(from: Timeline, to: Timeline) {
  return (
    from.lineStarts.length > 0 &&
    from.lineStarts.length === to.lineStarts.length &&
    isUsable(from.lineStarts) &&
    isUsable(to.lineStarts)
  );
}

/**
 * The same moment on another voice's timeline: matching lines by index, interpolating within a line. Before the first
 * line runs from each timeline's start to that line, and after the last one runs to each timeline's end, so the end of
 * one voice is exactly the end of another. Mismatched or unusable lines fall back to proportion of duration.
 */
export function convertPosition(sec: number, from: Timeline, to: Timeline) {
  const toEnd = isNumber(to.durationSec) ? Math.max(0, to.durationSec) : 0;
  const fromEnd = isNumber(from.durationSec) ? Math.max(0, from.durationSec) : 0;
  if (toEnd === 0 || fromEnd === 0 || !isNumber(sec)) return 0;
  const at = clamp(sec, 0, fromEnd);
  if (!linesMatch(from, to)) return (at / fromEnd) * toEnd;

  // Rounded line starts can land just past the real end
  const fromPoints = [0, ...from.lineStarts.map((s) => Math.min(s, fromEnd)), fromEnd];
  const toPoints = [0, ...to.lineStarts.map((s) => Math.min(s, toEnd)), toEnd];
  let i = fromPoints.length - 1;
  while (i > 0 && fromPoints[i] > at) i--;
  if (i === fromPoints.length - 1) return toEnd;
  const share = (at - fromPoints[i]) / (fromPoints[i + 1] - fromPoints[i]);
  return clamp(toPoints[i] + share * (toPoints[i + 1] - toPoints[i]), 0, toEnd);
}

/**
 * Line starts are rounded to whole seconds, so one can land after the sentence's first word. A phrase starting within
 * this many seconds of it is the same moment, with the exact time.
 */
const LINE_SNAP_SEC = 0.6;

/**
 * Where to land after switching voice: the start of the sentence being spoken, in the new voice. Before the first line,
 * and when lines can't be matched, it's the converted position instead.
 */
export function switchPosition(sec: number, from: Timeline, to: Timeline, toCaptions: CaptionPhrase[] = []) {
  const converted = convertPosition(sec, from, to);
  if (!linesMatch(from, to) || !isNumber(sec)) return converted;
  let line = -1;
  from.lineStarts.forEach((start, i) => {
    if (start <= sec) line = i;
  });
  if (line < 0) return converted;
  const lineStart = clamp(to.lineStarts[line], 0, Math.max(0, to.durationSec));
  let best = lineStart;
  let bestDistance = LINE_SNAP_SEC;
  for (const phrase of toCaptions) {
    const distance = Math.abs(phrase.startSec - lineStart);
    if (distance <= bestDistance) {
      best = phrase.startSec;
      bestDistance = distance;
    }
  }
  return clamp(best, 0, Math.max(0, to.durationSec));
}

// ── Captions ────────────────────────────────────────────────────────

/** What burned-in captions did (studio `src/collage/polish.tsx`): up 0.12 s before the first word, held up to 0.8 s after the last. */
export const CAPTION_LEAD_IN_SEC = 0.12;
export const CAPTION_LINGER_SEC = 0.8;

/**
 * The phrase on screen at `sec`, or null: during the intro, in gaps longer than the linger, after the last phrase.
 * `phrases` must have come through `normalizeCaptions`. The next phrase always takes over from the one before it.
 */
export function activeCaption(phrases: CaptionPhrase[], sec: number) {
  if (!isNumber(sec)) return null;
  let low = 0;
  let high = phrases.length - 1;
  let index = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (phrases[mid].startSec - CAPTION_LEAD_IN_SEC <= sec) {
      index = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (index < 0) return null;
  const phrase = phrases[index];
  return sec < phrase.endSec + CAPTION_LINGER_SEC ? phrase : null;
}

// ── Downloads ───────────────────────────────────────────────────────

/**
 * What a download keeps about its voice. No URLs: the file is on the device, and they expire. `defaultTimeline` is what
 * converts offline progress onto the default voice's timeline.
 */
export type DownloadedVoice = {
  id: string;
  name: string;
  isDefault: boolean;
  durationSec: number;
  transcript: TranscriptLine[];
  captions: CaptionPhrase[];
  defaultTimeline: Timeline;
};

/** Built field by field so nothing else from the API response (signed URLs, say) reaches the stored record. */
export function toDownloadedVoice(voice: EpisodeVoice, defaultTimeline: Timeline): DownloadedVoice {
  return {
    id: voice.id,
    name: voice.name,
    isDefault: voice.isDefault,
    durationSec: voice.durationSec,
    transcript: voice.transcript,
    captions: voice.captions,
    defaultTimeline: { lineStarts: defaultTimeline.lineStarts, durationSec: defaultTimeline.durationSec },
  };
}

/**
 * The voice stored on a download record, or null. Records from before voices have none, and they're not migrated: the
 * field is optional, the index stays version 1, and they play as they always did. A damaged one also plays that way.
 */
export function downloadedVoiceOf(record: { voice?: unknown }): DownloadedVoice | null {
  const voice = record.voice as DownloadedVoice | undefined | null;
  if (!voice || typeof voice.id !== 'string' || typeof voice.name !== 'string' || !isNumber(voice.durationSec)) return null;
  const timeline = voice.defaultTimeline;
  if (!timeline || !Array.isArray(timeline.lineStarts) || !isNumber(timeline.durationSec)) return null;
  return {
    id: voice.id,
    name: voice.name,
    isDefault: voice.isDefault === true,
    durationSec: voice.durationSec,
    transcript: normalizeTranscript(voice.transcript),
    captions: normalizeCaptions(voice.captions),
    defaultTimeline: { lineStarts: timeline.lineStarts, durationSec: timeline.durationSec },
  };
}

/** Parses `downloads/index.json`. Anything but version 1 reads as empty, so the version must not change for additive fields. */
export function parseDownloadIndex<T extends { version: 1; items: unknown[] }>(text: string, empty: T): T {
  const parsed = JSON.parse(text) as T | null;
  return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : empty;
}

/** The voices to offer: the API's plus the downloaded one. Offline, or if the API has dropped it, the download still plays. */
export function withDownloadedVoice(voices: EpisodeVoice[], downloaded: DownloadedVoice | null): EpisodeVoice[] {
  if (!downloaded || voices.some((v) => v.id === downloaded.id)) return voices;
  const { defaultTimeline: _timeline, ...voice } = downloaded;
  return [...voices, { ...voice, videoUrl: null, hlsUrl: null }];
}
