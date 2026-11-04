// Narrator logic: position conversion, caption lookup, download records, and failing safely. Plain Node (`pnpm test`).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { booksQuery } from '../src/lib/catalog-query.ts';
import { streamSources } from '../src/lib/stream-source.ts';
import {
  activeCaption,
  chooseVoice,
  convertPosition,
  downloadedVoiceOf,
  EPISODE_VOICES_QUERY,
  fetchEpisodeVoices,
  mergeKnownVoices,
  normalizeCaptions,
  normalizeVoices,
  parseDownloadIndex,
  switchPosition,
  timelineOf,
  toDownloadedVoice,
  withDownloadedVoice,
} from '../src/lib/voices.ts';

const lines = (...starts) => starts.map((startSec, i) => ({ startSec, text: `line ${i}` }));
const heart = { lineStarts: [5, 20, 60, 100], durationSec: 120 };
// The longest voice: same line count, every line later
const michael = { lineStarts: [5, 26, 80, 135], durationSec: 160 };

// ── Position conversion ──

test('identical timelines convert to the same position', () => {
  for (const sec of [0, 3, 5, 44.5, 100, 119.9, 120]) assert.equal(convertPosition(sec, heart, heart), sec);
});

test('a line start maps to the matching line start, both ways', () => {
  heart.lineStarts.forEach((start, i) => {
    assert.equal(convertPosition(start, heart, michael), michael.lineStarts[i]);
    assert.equal(convertPosition(michael.lineStarts[i], michael, heart), start);
  });
});

test('interpolates within a line', () => {
  // Halfway through michael's second line (26–80) is halfway through heart's (20–60)
  assert.equal(convertPosition(53, michael, heart), 40);
  assert.equal(convertPosition(40, heart, michael), 53);
});

test('before the first line runs from each start to that line', () => {
  const late = { lineStarts: [10, 30], durationSec: 60 };
  const early = { lineStarts: [5, 20], durationSec: 40 };
  assert.equal(convertPosition(0, late, early), 0);
  assert.equal(convertPosition(5, late, early), 2.5);
  assert.equal(convertPosition(2.5, early, late), 5);
});

test('after the last line runs to each end', () => {
  // michael 135–160 is heart 100–120
  assert.equal(convertPosition(147.5, michael, heart), 110);
  assert.equal(convertPosition(160, michael, heart), 120);
  assert.equal(convertPosition(120, heart, michael), 160);
});

test('clamps to both timelines, and bad numbers give 0', () => {
  assert.equal(convertPosition(-10, michael, heart), 0);
  assert.equal(convertPosition(9999, michael, heart), 120);
  assert.equal(convertPosition(Number.NaN, michael, heart), 0);
  assert.equal(convertPosition(Infinity, michael, heart), 0);
  assert.equal(convertPosition(50, { lineStarts: [], durationSec: 0 }, heart), 0);
  assert.equal(convertPosition(50, heart, { lineStarts: [], durationSec: 0 }), 0);
});

test('differing line counts fall back to proportion of duration', () => {
  const other = { lineStarts: [1, 2], durationSec: 240 };
  assert.equal(convertPosition(60, heart, other), 120);
  assert.equal(convertPosition(120, other, heart), 60);
  assert.equal(convertPosition(240, other, heart), 120);
});

test('no lines, or lines running backwards, fall back to proportion', () => {
  const none = { lineStarts: [], durationSec: 240 };
  assert.equal(convertPosition(60, heart, none), 120);
  assert.equal(convertPosition(60, { lineStarts: [5, 2], durationSec: 120 }, { lineStarts: [1, 2], durationSec: 240 }), 120);
});

test('equal rounded line starts never divide by zero', () => {
  const a = { lineStarts: [0, 0, 7, 7, 7, 20], durationSec: 30 };
  const b = { lineStarts: [0, 1, 8, 9, 10, 25], durationSec: 40 };
  for (let sec = 0; sec <= 30; sec += 0.25) {
    const out = convertPosition(sec, a, b);
    assert.ok(Number.isFinite(out) && out >= 0 && out <= 40, `${sec} → ${out}`);
  }
  for (let sec = 0; sec <= 40; sec += 0.25) assert.ok(Number.isFinite(convertPosition(sec, b, a)));
});

test('conversion only moves forward as playback does', () => {
  let previous = -1;
  for (let sec = 0; sec <= 160; sec += 0.25) {
    const out = convertPosition(sec, michael, heart);
    assert.ok(out >= previous, `${sec}`);
    previous = out;
  }
});

test('a rounded line start past the real end stays on the timeline', () => {
  const real = { lineStarts: [5, 304], durationSec: 303.616 };
  const def = { lineStarts: [5, 250], durationSec: 260 };
  assert.equal(convertPosition(303.616, real, def), 260);
  assert.ok(convertPosition(303, real, def) <= 260);
});

test('watching to the end of the longest voice completes on the server', () => {
  // The server: Math.round(position) clamped to the rounded duration, completed at 95% of it (backend progress.ts)
  const completes = (position, duration) => Math.min(Math.round(position), duration) >= 0.95 * duration;
  const defaultVoice = { lineStarts: [5, 100, 200, 290], durationSec: 304 };
  const longest = { lineStarts: [5, 130, 260, 370], durationSec: 400 };
  // The last whole second the player reports, on the video's real length (rounded up from 399.6)
  const real = { ...longest, durationSec: 399.6 };
  for (const sec of [399, 399.5, 399.6]) {
    assert.ok(completes(Math.floor(convertPosition(sec, real, defaultVoice)), 304), `${sec}`);
  }
  // Even leaving during the outro: everything past the last line maps past it too
  assert.ok(completes(convertPosition(390, real, defaultVoice), 304));
  assert.equal(completes(convertPosition(200, real, defaultVoice), 304), false);
});

test('leaving in one voice and resuming in another lands on the same line', () => {
  const saved = Math.floor(convertPosition(53, michael, heart));
  const resumed = convertPosition(saved, heart, { lineStarts: [4, 15, 45, 75], durationSec: 90 });
  assert.ok(resumed >= 15 && resumed < 45);
});

// ── Switching voice ──

test('switching lands on the start of the matching line', () => {
  assert.equal(switchPosition(30, heart, michael), 26);
  assert.equal(switchPosition(20, heart, michael), 26);
  assert.equal(switchPosition(119, heart, michael), 135);
});

test('switching uses the exact phrase time when a rounded line start has one', () => {
  const captions = [
    { startSec: 25.6, endSec: 27, text: 'a' },
    { startSec: 27.1, endSec: 29, text: 'b' },
  ];
  assert.equal(switchPosition(30, heart, michael, captions), 25.6);
  assert.equal(switchPosition(30, heart, michael, [{ startSec: 40, endSec: 41, text: 'far' }]), 26);
});

test('switching in the intro stays proportional, and mismatched lines fall back', () => {
  assert.equal(switchPosition(2.5, { lineStarts: [10], durationSec: 20 }, { lineStarts: [20], durationSec: 40 }), 5);
  assert.equal(switchPosition(60, heart, { lineStarts: [1], durationSec: 240 }), 120);
});

// ── Captions ──

const phrases = normalizeCaptions([
  { startSec: 4.8, endSec: 6, text: 'He said, "First' },
  { startSec: 6, endSec: 7.5, text: 'and last."' },
  { startSec: 9, endSec: 10, text: 'After a gap.' },
  { startSec: 11, endSec: 11, text: 'zero length' },
  { startSec: 20, endSec: 21, text: 'Far on.' },
]);

test('no caption in the intro, then a small lead-in', () => {
  assert.equal(activeCaption(phrases, 0), null);
  assert.equal(activeCaption(phrases, 4.6), null);
  assert.equal(activeCaption(phrases, 4.7)?.text, 'He said, "First');
});

test('touching phrases hand over without a gap and keep their punctuation', () => {
  assert.equal(activeCaption(phrases, 5.87)?.text, 'He said, "First');
  assert.equal(activeCaption(phrases, 5.9)?.text, 'and last."');
});

test('lingers across a short gap, and clears after a long one', () => {
  assert.equal(activeCaption(phrases, 8.2)?.text, 'and last."');
  assert.equal(activeCaption(phrases, 8.89)?.text, 'After a gap.');
  assert.equal(activeCaption(phrases, 10.5)?.text, 'After a gap.');
  assert.equal(activeCaption(phrases, 11), null);
  assert.equal(activeCaption(phrases, 15), null);
});

test('after the last phrase there is nothing', () => {
  assert.equal(activeCaption(phrases, 21.5)?.text, 'Far on.');
  assert.equal(activeCaption(phrases, 21.8), null);
  assert.equal(activeCaption(phrases, 500), null);
});

test('zero-length, reversed and empty phrases are dropped, and order is fixed', () => {
  assert.deepEqual(
    normalizeCaptions([
      { startSec: 3, endSec: 3, text: 'zero' },
      { startSec: 5, endSec: 4, text: 'reversed' },
      { startSec: 6, endSec: 7, text: '  ' },
      { startSec: 2, endSec: 2.5, text: 'b' },
      { startSec: 1, endSec: 1.5, text: 'a' },
      null,
    ]).map((p) => p.text),
    ['a', 'b'],
  );
  assert.deepEqual(normalizeCaptions(null), []);
  assert.equal(activeCaption([], 3), null);
  assert.equal(activeCaption(phrases, Number.NaN), null);
  // Only a zero-length phrase: nothing ever shows
  const only = normalizeCaptions([{ startSec: 1, endSec: 1, text: 'x' }]);
  for (const t of [0.9, 1, 1.1]) assert.equal(activeCaption(only, t), null);
});

// ── Choosing a voice ──

const voice = (id, extra = {}) => ({
  id,
  name: id.toUpperCase(),
  isDefault: false,
  videoUrl: `${id}.mp4`,
  hlsUrl: null,
  durationSec: 100,
  transcript: lines(1, 2),
  captions: [],
  ...extra,
});

test('the preference is used when offered, otherwise the default', () => {
  const voices = [voice('a', { isDefault: true }), voice('b')];
  assert.equal(chooseVoice(voices, 'b', false).id, 'b');
  assert.equal(chooseVoice(voices, 'gone', false).id, 'a');
  assert.equal(chooseVoice(voices, null, false).id, 'a');
  assert.equal(chooseVoice([], 'b', false), null);
});

test('a voice whose signing failed is not chosen', () => {
  const voices = [voice('a', { isDefault: true }), voice('b', { videoUrl: null })];
  assert.equal(chooseVoice(voices, 'b', false).id, 'a');
  assert.equal(chooseVoice([voice('a', { isDefault: true, videoUrl: null })], null, false), null);
});

test('streams follow the same HLS rules as episodes', () => {
  const both = voice('a', { hlsUrl: 'a.m3u8' });
  assert.deepEqual(streamSources(both, true), { source: 'a.m3u8', fallback: 'a.mp4' });
  assert.deepEqual(streamSources(both, false), { source: 'a.mp4', fallback: null });
  assert.equal(chooseVoice([voice('a', { isDefault: true, videoUrl: null, hlsUrl: 'a.m3u8' })], null, false), null);
  assert.equal(chooseVoice([voice('a', { isDefault: true, videoUrl: null, hlsUrl: 'a.m3u8' })], null, true).id, 'a');
});

test('remembered voices stay small', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `v${i}`, name: `V${i}` }));
  assert.equal(mergeKnownVoices([], many).length, 12);
  assert.deepEqual(
    mergeKnownVoices([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], [voice('b')]),
    [{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }],
  );
  assert.deepEqual(Object.keys(mergeKnownVoices([], [voice('b')])[0]), ['id', 'name']);
});

// ── A failing or missing API ──

test('an API without episodeVoices gives null and never throws', async () => {
  const failing = [
    () => Promise.reject(new Error('Cannot query field "episodeVoices" on type "Query".')),
    () => Promise.reject(new TypeError('Network request failed')),
    () => Promise.resolve(null),
    () => Promise.resolve({ episodeVoices: 'nonsense' }),
    () => {
      throw new Error('synchronous');
    },
  ];
  for (const request of failing) assert.equal(await fetchEpisodeVoices(request, 'b-1', 1000), null);
});

test('a slow answer times out, and a rejection after that goes nowhere', async () => {
  const slow = () => new Promise((_, reject) => setTimeout(() => reject(new Error('late')), 40));
  assert.equal(await fetchEpisodeVoices(slow, 'b-1', 5), null);
  await new Promise((resolve) => setTimeout(resolve, 60));
});

test('[] is an answer, and asks with the episode id', async () => {
  let asked;
  const request = (query, variables) => {
    asked = { query, variables };
    return Promise.resolve({ episodeVoices: [] });
  };
  assert.deepEqual(await fetchEpisodeVoices(request, 'b-1', 1000), []);
  assert.equal(asked.query, EPISODE_VOICES_QUERY);
  assert.deepEqual(asked.variables, { episodeId: 'b-1' });
});

test('malformed voices are dropped, and without a default it plays as legacy', () => {
  assert.equal(normalizeVoices(undefined), null);
  assert.deepEqual(normalizeVoices([voice('a')]), []);
  const out = normalizeVoices([voice('a', { isDefault: true, captions: [{ startSec: 1, endSec: 1, text: 'x' }] }), { id: 3 }, null]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].captions, []);
});

test('the catalog never asks for voices', () => {
  for (const flag of [false, true]) assert.doesNotMatch(booksQuery(flag), /episodeVoices|captions/);
  const source = readFileSync(new URL('../src/lib/catalog.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /episodeVoices/);
});

// ── Download records ──

const OLD_RECORD = {
  episodeId: 'b-1',
  bookId: 'b',
  book: { id: 'b', episodes: [] },
  episode: { id: 'b-1', durationSec: 100, transcript: lines(1, 2), videoUrl: 'old.mp4', thumbnailUrl: null },
  hasThumbnail: false,
  bytes: 10,
  downloadedAt: '2026-10-01T00:00:00.000Z',
};
const EMPTY = { version: 1, userId: null, items: [] };

test('downloads from before voices read back unchanged, with no voice', () => {
  const text = JSON.stringify({ version: 1, userId: 'u', items: [OLD_RECORD] });
  const index = parseDownloadIndex(text, EMPTY);
  assert.deepEqual(index.items[0], OLD_RECORD);
  assert.equal(downloadedVoiceOf(index.items[0]), null);
  assert.deepEqual(withDownloadedVoice([], null), []);
});

test('the index stays version 1, and other versions still read as empty', () => {
  assert.equal(parseDownloadIndex('{"version":2,"items":[]}', EMPTY), EMPTY);
  assert.equal(parseDownloadIndex('null', EMPTY), EMPTY);
  assert.equal(parseDownloadIndex('{"version":1}', EMPTY), EMPTY);
  assert.throws(() => parseDownloadIndex('{broken', EMPTY));
  const source = readFileSync(new URL('../src/lib/downloads.tsx', import.meta.url), 'utf8');
  assert.match(source, /version: 1, userId: null/);
});

test('a saved voice round-trips with what conversion needs, and no URLs', () => {
  const def = voice('heart', { isDefault: true, transcript: lines(5, 20), durationSec: 120 });
  const stored = toDownloadedVoice(
    voice('michael', {
      videoUrl: 'https://signed.example/m.mp4?sig=secret',
      hlsUrl: 'https://signed.example/m.m3u8',
      durationSec: 160,
      transcript: lines(5, 26),
      captions: [{ startSec: 5, endSec: 6, text: 'Hello' }],
    }),
    timelineOf(def),
  );
  const text = JSON.stringify({ version: 1, userId: 'u', items: [{ ...OLD_RECORD, voice: stored }] });
  assert.doesNotMatch(text.replace('old.mp4', ''), /signed\.example|m3u8|hlsUrl/);

  const read = downloadedVoiceOf(parseDownloadIndex(text, EMPTY).items[0]);
  assert.deepEqual(read.defaultTimeline, { lineStarts: [5, 20], durationSec: 120 });
  assert.equal(read.captions[0].text, 'Hello');
  // Offline progress lands on the default timeline
  assert.equal(convertPosition(26, timelineOf(read), read.defaultTimeline), 20);
  assert.equal(convertPosition(160, timelineOf(read), read.defaultTimeline), 120);
});

test('offline only the downloaded voice is offered; online the rest join it', () => {
  const stored = toDownloadedVoice(voice('michael'), timelineOf(voice('heart', { isDefault: true })));
  const offline = withDownloadedVoice([], stored);
  assert.deepEqual(offline.map((v) => v.id), ['michael']);
  assert.equal(offline[0].videoUrl, null);
  assert.equal('defaultTimeline' in offline[0], false);
  const online = [voice('heart', { isDefault: true }), voice('michael')];
  assert.equal(withDownloadedVoice(online, stored), online);
});

test('a damaged saved voice plays as a download without voices', () => {
  for (const bad of [null, 'x', {}, { id: 'a' }, { id: 'a', name: 'A', durationSec: 5 }, { id: 'a', name: 'A', durationSec: 5, defaultTimeline: {} }]) {
    assert.equal(downloadedVoiceOf({ voice: bad }), null, JSON.stringify(bad));
  }
  const partial = { id: 'a', name: 'A', durationSec: 5, defaultTimeline: { lineStarts: [1], durationSec: 9 } };
  const read = downloadedVoiceOf({ voice: partial });
  assert.deepEqual(read.transcript, []);
  assert.deepEqual(read.captions, []);
});
