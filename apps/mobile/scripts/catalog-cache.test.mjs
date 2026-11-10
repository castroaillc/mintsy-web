// The catalog saved on the device: when a saved copy may be shown, and when it must be ignored. Plain Node (`pnpm test`).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CATALOG_CACHE_MAX_AGE_MS,
  CATALOG_CACHE_VERSION,
  createCatalogSnapshot,
  parseCatalogSnapshot,
  snapshotBooksFor,
} from '../src/lib/catalog-cache.ts';
import { booksQuery } from '../src/lib/catalog-query.ts';

const QUERY = booksQuery(false);
const NOW = Date.UTC(2026, 10, 5, 12);
const HOUR = 60 * 60 * 1000;

const episode = (n, extra = {}) => ({
  id: `money-${n}`,
  number: n,
  title: `Episode ${n}`,
  summary: '',
  durationSec: 300,
  transcript: [{ startSec: 0, text: 'Hello' }],
  takeaways: [],
  videoUrl: `https://media.example/money/${n}.mp4`,
  thumbnailUrl: null,
  locked: false,
  ...extra,
});
const BOOKS = [
  {
    id: 'money',
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    category: 'Finance',
    coverTone: '#E7DFCF',
    tint: '#24382F',
    description: '',
    episodes: [episode(1), episode(4, { locked: true, videoUrl: null, transcript: [] })],
  },
];

/** Round trip through the file's text, as the app does. */
const saved = (books, key) => JSON.stringify(createCatalogSnapshot(books, key));
const read = (text, key) => snapshotBooksFor(parseCatalogSnapshot(text), key);

test('a saved copy comes back for the same viewer and query, unchanged', () => {
  const text = saved(BOOKS, { query: QUERY, userId: 'u1', now: NOW });
  assert.deepEqual(read(text, { query: QUERY, userId: 'u1', now: NOW + HOUR }), BOOKS);
});

test('signed out has its own copy, and never sees an account’s', () => {
  const anon = saved(BOOKS, { query: QUERY, userId: null, now: NOW });
  assert.deepEqual(read(anon, { query: QUERY, userId: null, now: NOW }), BOOKS);

  const account = saved(BOOKS, { query: QUERY, userId: 'u1', now: NOW });
  assert.equal(read(account, { query: QUERY, userId: null, now: NOW }), null);
  // Locks and video URLs were for u1: another account gets nothing
  assert.equal(read(account, { query: QUERY, userId: 'u2', now: NOW }), null);
});

test('a copy fetched with another query (new fields, the HLS flag) is ignored', () => {
  const text = saved(BOOKS, { query: QUERY, userId: 'u1', now: NOW });
  assert.equal(read(text, { query: booksQuery(true), userId: 'u1', now: NOW }), null);
});

test('another cache version is ignored', () => {
  const snapshot = createCatalogSnapshot(BOOKS, { query: QUERY, userId: 'u1', now: NOW });
  const text = JSON.stringify({ ...snapshot, version: CATALOG_CACHE_VERSION + 1 });
  assert.equal(parseCatalogSnapshot(text), null);
  assert.equal(parseCatalogSnapshot(JSON.stringify({ ...snapshot, version: undefined })), null);
});

test('too old, or from the future, is ignored', () => {
  const text = saved(BOOKS, { query: QUERY, userId: 'u1', now: NOW });
  assert.deepEqual(read(text, { query: QUERY, userId: 'u1', now: NOW + CATALOG_CACHE_MAX_AGE_MS }), BOOKS);
  assert.equal(read(text, { query: QUERY, userId: 'u1', now: NOW + CATALOG_CACHE_MAX_AGE_MS + 1 }), null);
  // Saved "tomorrow": the device clock moved back
  assert.equal(read(text, { query: QUERY, userId: 'u1', now: NOW - 24 * HOUR }), null);
  // A little drift is fine
  assert.deepEqual(read(text, { query: QUERY, userId: 'u1', now: NOW - 60 * 1000 }), BOOKS);
});

test('missing, corrupt or malformed files are ignored without throwing', () => {
  const key = { query: QUERY, userId: 'u1', now: NOW };
  for (const text of [null, undefined, '', '{', 'null', '[]', '"books"', '{"version":1}']) {
    assert.equal(read(text, key), null, String(text));
  }
  const good = createCatalogSnapshot(BOOKS, { query: QUERY, userId: 'u1', now: NOW });
  const variants = [
    { ...good, books: 'nope' },
    { ...good, books: [{ ...BOOKS[0], id: 7 }] },
    { ...good, books: [{ ...BOOKS[0], episodes: null }] },
    { ...good, books: [{ ...BOOKS[0], episodes: [{ ...episode(1), transcript: undefined }] }] },
    { ...good, books: [{ ...BOOKS[0], episodes: [{ ...episode(1), number: '1' }] }] },
    { ...good, userId: 42 },
    { ...good, savedAt: '2026-11-05' },
    { ...good, query: undefined },
  ];
  for (const variant of variants) assert.equal(read(JSON.stringify(variant), key), null, JSON.stringify(variant).slice(0, 80));
});

test('an empty catalog is a valid saved copy', () => {
  const text = saved([], { query: QUERY, userId: null, now: NOW });
  assert.deepEqual(read(text, { query: QUERY, userId: null, now: NOW }), []);
});

test('locks are kept exactly as the API sent them', () => {
  const text = saved(BOOKS, { query: QUERY, userId: 'u1', now: NOW });
  const [book] = read(text, { query: QUERY, userId: 'u1', now: NOW });
  assert.equal(book.episodes[1].locked, true);
  assert.equal(book.episodes[1].videoUrl, null);
});
