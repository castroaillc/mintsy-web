# Account flows

The app (and web app) call these through the Better Auth client. `<scheme>` is `mintsy` (production) or `mintsy-dev` (dev builds). The web app uses `https://app.getmintsy.com/...` URLs instead of deep links.

## Password reset

1. The client calls `authClient.requestPasswordReset({ email, redirectTo: "<scheme>://reset-password" })` → `POST /api/auth/request-password-reset`. The response is the same whether or not the email exists.
2. The user gets an email linking to `/api/auth/reset-password/<token>?callbackURL=<scheme>://reset-password`.
3. Opening it redirects to `<scheme>://reset-password/?token=<token>`, or `?error=INVALID_TOKEN` when the token is expired or used.
4. The client calls `authClient.resetPassword({ newPassword, token })` → `POST /api/auth/reset-password`.

Tokens last 1 hour and are single use. A reset signs out every session (`revokeSessionsOnPasswordReset`).

{% hint style="info" %}
Better Auth adds a trailing slash before `?` in the redirect (`reset-password/?token=`). The app strips it when handling the deep link.
{% endhint %}

## Change password

`authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })` → `POST /api/auth/change-password`. The calling device gets a new session; other devices are signed out.

## Change email

1. `authClient.changeEmail({ newEmail, callbackURL: "<scheme>://email-changed" })` → `POST /api/auth/change-email`.
2. A confirmation link goes to the **new** address, and a heads-up with no link goes to the current one.
3. The stored email only changes when the link is opened. It then becomes `emailVerified: true` and the browser is redirected to `<scheme>://email-changed`, or `<scheme>://email-changed/?error=<CODE>`:

| Code | Meaning |
| --- | --- |
| `TOKEN_EXPIRED` | Older than 1 hour. |
| `INVALID_TOKEN` | Malformed or unknown token. |
| `USER_NOT_FOUND` | The link was already used. |
| `INVALID_USER` | Returned by Better Auth. TODO: confirm the exact cause. |

If the new address already belongs to an account, the response is the same but nothing is sent. Opening the link never creates a session (an `after` hook revokes it). Sign-up doesn't send verification emails.

## Delete account

`authClient.deleteUser({ password })` → `POST /api/auth/delete-user`. Required by App Store guideline 5.1.1(v).

| User | Rule | Errors |
| --- | --- | --- |
| Has a password (`credential` account) | Password required, however old the session | `400 PASSWORD_REQUIRED` without one, `400 INVALID_PASSWORD` when wrong |
| No password (Google / Apple only) | `deleteUser({})` from a session under 10 minutes old | `403 REAUTH_REQUIRED`: sign in with the provider again, then retry. Sending a password gets `400 CREDENTIAL_ACCOUNT_NOT_FOUND`. |
| Signed out | | `401` |

Deletion is immediate. `src/account.ts`:

1. `deleteUserData()` removes the user's `pushTokens`, `entitlements`, `saved_items`, `watch_progress` and `verification` documents, before Better Auth deletes the user, sessions and accounts, and again afterwards in case anything was written in between.
2. When `REVENUECAT_SECRET_API_KEY` is set, it calls RevenueCat `DELETE /v1/subscribers/{id}`. Failures are logged, not fatal; 404 counts as deleted.
3. It logs `[audit] account deleted: user <id>` (no email).

It does **not** cancel an App Store / Play subscription; the app tells the user to cancel in the store.

{% hint style="warning" %}
Any new per-user data the backend stores must also be deleted in `deleteUserData()`.
{% endhint %}

## Which sign-in methods a user has

`authClient.listAccounts()` → `GET /api/auth/list-accounts`:

```json
[{ "id": "...", "providerId": "credential", "accountId": "...", "userId": "...", "createdAt": "...", "updatedAt": "...", "scopes": [] }]
```

`providerId` is `credential`, `google` or `apple`. No `credential` entry = no password, so hide change email and change password.
