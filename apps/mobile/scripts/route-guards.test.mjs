// Guest mode's route guards (App Store guideline 5.1.1(v)). Plain Node (run with `pnpm test`); the module has no imports.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accountReasonMessage, ACCOUNT_REASONS, routeAccess } from '../src/lib/route-guards.ts';

test('guests get the app and the auth screens, never onboarding', () => {
  const access = routeAccess({ signedIn: false, onboardingLoaded: false, onboarded: false });
  assert.equal(access.app, true);
  assert.equal(access.auth, true);
  assert.equal(access.onboarding, false);
});

test('just signed in, answers still loading: the auth screens stay up over the app', () => {
  for (const onboarded of [false, true]) {
    const access = routeAccess({ signedIn: true, onboardingLoaded: false, onboarded });
    assert.equal(access.app, true, 'the app under the sign-in sheet stays, so the guest keeps their place');
    assert.equal(access.auth, true);
    assert.equal(access.onboarding, false);
  }
});

test('an onboarded account goes back to the app and the auth screens close', () => {
  const access = routeAccess({ signedIn: true, onboardingLoaded: true, onboarded: true });
  assert.deepEqual([access.app, access.onboarding, access.auth], [true, false, false]);
  assert.equal(access.authRedirect, '/');
});

test('a new account goes through onboarding before the app', () => {
  const access = routeAccess({ signedIn: true, onboardingLoaded: true, onboarded: false });
  assert.deepEqual([access.app, access.onboarding, access.auth], [false, true, false]);
  assert.equal(access.appRedirect, '/onboarding');
  assert.equal(access.authRedirect, '/onboarding');
});

test('signing out (or deleting the account) keeps the app open as a guest', () => {
  const before = routeAccess({ signedIn: true, onboardingLoaded: true, onboarded: true });
  const after = routeAccess({ signedIn: false, onboardingLoaded: false, onboarded: false });
  assert.equal(before.app, true);
  assert.equal(after.app, true);
  assert.equal(after.onboarding, false);
});

test('every state leaves at least one group open', () => {
  for (const signedIn of [false, true]) {
    for (const onboardingLoaded of [false, true]) {
      for (const onboarded of [false, true]) {
        const a = routeAccess({ signedIn, onboardingLoaded, onboarded });
        assert.ok(a.app || a.onboarding || a.auth, JSON.stringify({ signedIn, onboardingLoaded, onboarded }));
      }
    }
  }
});

test('account reasons: known keys only', () => {
  assert.equal(accountReasonMessage('save'), ACCOUNT_REASONS.save);
  assert.equal(accountReasonMessage(['subscribe']), ACCOUNT_REASONS.subscribe);
  assert.equal(accountReasonMessage('restore'), ACCOUNT_REASONS.restore);
  assert.equal(accountReasonMessage(undefined), undefined);
  assert.equal(accountReasonMessage('toString'), undefined);
  assert.equal(accountReasonMessage('nope'), undefined);
});
