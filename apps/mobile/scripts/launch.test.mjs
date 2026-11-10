// What a launch waits for, per path (fresh install, signed-in relaunch, offline), and reading the stored session
// cookie. Plain Node (`pnpm test`).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { launchGate } from '../src/lib/launch-gate.ts';
import { hasSessionCookie } from '../src/lib/session-cookie.ts';

const NOW = Date.UTC(2026, 10, 5, 12);
const jar = (cookies) => JSON.stringify(cookies);

// ── The stored cookie jar ──

test('no jar, an empty jar or a signed-out jar: no session', () => {
  assert.equal(hasSessionCookie(null, NOW), false);
  assert.equal(hasSessionCookie(undefined, NOW), false);
  assert.equal(hasSessionCookie('', NOW), false);
  // What the plugin writes on sign-out
  assert.equal(hasSessionCookie('{}', NOW), false);
  assert.equal(hasSessionCookie('not json', NOW), false);
  assert.equal(hasSessionCookie('null', NOW), false);
  // Other cookies only
  assert.equal(hasSessionCookie(jar({ 'better-auth.state': { value: 'x', expires: null } }), NOW), false);
});

test('a live session token counts, with or without an expiry and the __Secure- prefix', () => {
  const later = new Date(NOW + 60_000).toISOString();
  assert.equal(hasSessionCookie(jar({ 'better-auth.session_token': { value: 'abc', expires: later } }), NOW), true);
  assert.equal(hasSessionCookie(jar({ 'better-auth.session_token': { value: 'abc', expires: null } }), NOW), true);
  assert.equal(hasSessionCookie(jar({ '__Secure-better-auth.session_token': { value: 'abc', expires: later } }), NOW), true);
});

test('an expired or empty token is not sent, so it counts as signed out', () => {
  const earlier = new Date(NOW - 1).toISOString();
  assert.equal(hasSessionCookie(jar({ 'better-auth.session_token': { value: 'abc', expires: earlier } }), NOW), false);
  assert.equal(hasSessionCookie(jar({ 'better-auth.session_token': { value: '', expires: null } }), NOW), false);
  assert.equal(hasSessionCookie(jar({ 'better-auth.session_token': null }), NOW), false);
});

// ── The launch gate ──

const base = {
  sessionKnown: true,
  signedIn: false,
  themeLoaded: true,
  fontsReady: true,
  onboardingLoaded: false,
  catalogStatus: 'loading',
  catalogDeviceChecked: true,
  catalogHasBooks: false,
  hasDownloads: false,
};

test('fresh install (signed out): Welcome without the catalog or the network', () => {
  // Nothing from the API yet, nothing saved: the splash still goes and Welcome is usable
  assert.deepEqual(launchGate(base), { show: true, catalogError: false, interactive: true });
  // The catalog failing doesn't matter to Welcome
  assert.deepEqual(launchGate({ ...base, catalogStatus: 'error' }), { show: true, catalogError: false, interactive: true });
});

test('signed out still waits for the session answer, the theme, the fonts and the device cache read', () => {
  for (const key of ['sessionKnown', 'themeLoaded', 'fontsReady', 'catalogDeviceChecked']) {
    assert.deepEqual(launchGate({ ...base, [key]: false }), { show: false, catalogError: false, interactive: false }, key);
  }
});

const signedIn = { ...base, signedIn: true, onboardingLoaded: true };

test('signed-in relaunch with a saved catalog: up at once, interactive at once', () => {
  assert.deepEqual(launchGate({ ...signedIn, catalogStatus: 'ready', catalogHasBooks: true }), {
    show: true,
    catalogError: false,
    interactive: true,
  });
});

test('signed in waits for the onboarding answers and the device cache read, never the network', () => {
  const ready = { ...signedIn, catalogStatus: 'ready', catalogHasBooks: true };
  assert.equal(launchGate({ ...ready, onboardingLoaded: false }).show, false);
  assert.equal(launchGate({ ...ready, catalogDeviceChecked: false }).show, false);
  // Nothing saved, still fetching: the screens show their loading state, and it isn't interactive yet
  assert.deepEqual(launchGate(signedIn), { show: true, catalogError: false, interactive: false });
});

test('offline, signed in, with a saved catalog: up with the saved copy', () => {
  assert.deepEqual(launchGate({ ...signedIn, catalogStatus: 'error', catalogHasBooks: true }), {
    show: true,
    catalogError: false,
    interactive: true,
  });
});

test('offline, signed in, nothing saved but downloads: up to watch them', () => {
  assert.deepEqual(launchGate({ ...signedIn, catalogStatus: 'error', hasDownloads: true }), {
    show: true,
    catalogError: false,
    interactive: true,
  });
});

test('offline, signed in, nothing saved and no downloads: "Couldn’t load mintsy", not interactive', () => {
  assert.deepEqual(launchGate({ ...signedIn, catalogStatus: 'error' }), { show: true, catalogError: true, interactive: false });
});

test('an empty catalog from the API is ready, not loading', () => {
  assert.equal(launchGate({ ...signedIn, catalogStatus: 'ready' }).interactive, true);
});
