// When the player's controls may fade by themselves. Plain Node (`pnpm test`).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canAutoHide, isStopped } from '../src/lib/player-controls.ts';

const watching = { playing: true, scrubbing: false, menuOpen: false, screenReader: false };

test('controls fade while a video plays and nothing else is going on', () => {
  assert.equal(canAutoHide(watching), true);
});

test('anything the viewer is doing holds them up', () => {
  assert.equal(canAutoHide({ ...watching, playing: false }), false, 'paused');
  assert.equal(canAutoHide({ ...watching, scrubbing: true }), false, 'scrubbing');
  assert.equal(canAutoHide({ ...watching, menuOpen: true }), false, 'narrator alert');
  assert.equal(canAutoHide({ ...watching, screenReader: true }), false, 'screen reader');
});

test('a pause or an end stops playback, and a stall does not', () => {
  assert.equal(isStopped({ playing: false, buffering: false }), true);
  assert.equal(isStopped({ playing: false, buffering: true }), false);
  assert.equal(isStopped({ playing: true, buffering: false }), false);
});
