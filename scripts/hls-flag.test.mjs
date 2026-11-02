// The HLS flag's safety checks. Plain Node (run with `pnpm test`); the modules under test have no React Native imports.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { booksQuery, legacyBooksQuery } from '../src/lib/catalog-query.ts';
import { streamSources } from '../src/lib/stream-source.ts';

// Production's API has no Episode.hlsUrl: with the flag off, the text sent must stay exactly this.
const QUERY_OFF = `#graphql
  query Books {
    books {
      id
      title
      author
      category
      coverTone
      coverUrl
      tint
      description
      episodes {
        id
        number
        title
        summary
        durationSec
        transcript { startSec text }
        takeaways
        videoUrl
        thumbnailUrl
        locked
      }
    }
  }
`;

const hlsModule = async (env, os) => {
  process.env.EXPO_PUBLIC_HLS_ENABLED = env;
  if (os) process.env.EXPO_OS = os;
  else delete process.env.EXPO_OS;
  return import(`../src/lib/stream-source.ts?${encodeURIComponent(`${env}-${os}`)}`);
};

test('flag off: the query is unchanged and never mentions hlsUrl', () => {
  assert.equal(booksQuery(false), QUERY_OFF);
  assert.doesNotMatch(legacyBooksQuery(booksQuery(false)), /hlsUrl/);
});

test('flag on: the query only adds hlsUrl', () => {
  assert.equal(booksQuery(true), QUERY_OFF.replace('        videoUrl\n', '        videoUrl\n        hlsUrl\n'));
});

test('the flag is on only for exactly "true", and never on web', async () => {
  for (const value of ['', 'false', '1', 'TRUE', 'True', ' true', 'true ', 'yes']) {
    assert.equal((await hlsModule(value)).HLS_ENABLED, false, JSON.stringify(value));
  }
  assert.equal((await hlsModule('true')).HLS_ENABLED, true);
  assert.equal((await hlsModule('true', 'ios')).HLS_ENABLED, true);
  assert.equal((await hlsModule('true', 'web')).HLS_ENABLED, false);
});

test('stream choice', () => {
  const both = { videoUrl: 'a.mp4', hlsUrl: 'a.m3u8' };
  assert.deepEqual(streamSources(both, true), { source: 'a.m3u8', fallback: 'a.mp4' });
  assert.deepEqual(streamSources(both, false), { source: 'a.mp4', fallback: null });
  assert.deepEqual(streamSources({ videoUrl: 'a.mp4', hlsUrl: null }, true), { source: 'a.mp4', fallback: null });
  assert.deepEqual(streamSources({ videoUrl: 'a.mp4' }, true), { source: 'a.mp4', fallback: null });
  assert.deepEqual(streamSources({ videoUrl: null, hlsUrl: 'a.m3u8' }, true), { source: 'a.m3u8', fallback: null });
  assert.equal(streamSources({ videoUrl: null, hlsUrl: 'a.m3u8' }, false), null);
  assert.equal(streamSources({ videoUrl: null, hlsUrl: null }, true), null);
});

test('downloads never ask for hlsUrl, so their stored records stay as they are', () => {
  const source = readFileSync(new URL('../src/lib/downloads.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /hlsUrl/);
});
