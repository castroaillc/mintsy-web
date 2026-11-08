// Delete account's Apple ID check, run before the credential is sent to the backend. Plain Node (run with `pnpm test`); the module has no imports.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkAppleIdentity, linkedAppleAccountIds } from '../src/lib/apple-identity.ts';

test('the linked Apple ID matches', () => {
  assert.equal(checkAppleIdentity('001234.abc.0001', ['001234.abc.0001']), 'match');
  assert.equal(checkAppleIdentity('001234.abc.0002', ['001234.abc.0001', '001234.abc.0002']), 'match');
});

test('another Apple ID is stopped before signing in', () => {
  assert.equal(checkAppleIdentity('009999.zzz.0001', ['001234.abc.0001']), 'mismatch');
});

test('no linked ids or no Apple user id: unknown, so the session check decides', () => {
  assert.equal(checkAppleIdentity('001234.abc.0001', []), 'unknown');
  assert.equal(checkAppleIdentity('001234.abc.0001', [null, undefined, '']), 'unknown');
  assert.equal(checkAppleIdentity(null, ['001234.abc.0001']), 'unknown');
  assert.equal(checkAppleIdentity('', ['001234.abc.0001']), 'unknown');
});

test('only Apple accounts from listAccounts() count', () => {
  const accounts = [
    { providerId: 'credential', accountId: 'user_1' },
    { providerId: 'google', accountId: '1077' },
    { providerId: 'apple', accountId: '001234.abc.0001' },
    { providerId: 'apple' },
    null,
  ];
  assert.deepEqual(linkedAppleAccountIds(accounts), ['001234.abc.0001']);
  // A Google account id never matches an Apple ID
  assert.equal(checkAppleIdentity('1077', linkedAppleAccountIds(accounts)), 'mismatch');
});
