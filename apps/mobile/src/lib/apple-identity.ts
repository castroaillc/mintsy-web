/**
 * Does the Apple ID picked in the Sign in with Apple sheet belong to this mintsy account? Checked before the credential
 * is sent to the backend, so picking another Apple ID while deleting an account never signs in as (or creates) a
 * different mintsy account. No imports, so the unit test can run it in plain Node.
 *
 * - `appleUser`: `credential.user` from expo-apple-authentication, the stable Apple user id (the ID token's `sub`).
 * - `linkedAppleIds`: the `accountId` of each `providerId: 'apple'` account from Better Auth's `listAccounts()`
 *   (Better Auth stores the Apple `sub` there).
 *
 * `unknown` means it can't be checked here (no linked ids loaded, or no Apple user id): the caller falls back to
 * signing in and comparing the session's user id afterwards.
 */
export type AppleIdentityCheck = 'match' | 'mismatch' | 'unknown';

export function checkAppleIdentity(
  appleUser: string | null | undefined,
  linkedAppleIds: readonly (string | null | undefined)[],
): AppleIdentityCheck {
  const ids = linkedAppleIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (!appleUser || ids.length === 0) return 'unknown';
  return ids.includes(appleUser) ? 'match' : 'mismatch';
}

/** The Apple `accountId`s among `listAccounts()` results. */
export function linkedAppleAccountIds(accounts: readonly unknown[]): string[] {
  const ids: string[] = [];
  for (const a of accounts) {
    const { providerId, accountId } = (a ?? {}) as { providerId?: unknown; accountId?: unknown };
    if (providerId === 'apple' && typeof accountId === 'string' && accountId) ids.push(accountId);
  }
  return ids;
}
