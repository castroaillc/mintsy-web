# HTTP endpoints

Everything the server answers, apart from GraphQL operations (see [GraphQL API](../graphql-api/README.md)).

| Method and path | Auth | Description |
| --- | --- | --- |
| `POST /graphql` | session optional | GraphQL API. `GET` serves Apollo Sandbox in development. |
| `ALL /api/auth/*` | varies | Better Auth. See [Authentication](../authentication/README.md). |
| `POST /webhooks/revenuecat` | `Authorization` = `REVENUECAT_WEBHOOK_AUTH` | RevenueCat subscription events. See [Premium and RevenueCat](../features/premium.md). |
| `GET /health` | none | `{ "status": "ok" }`. Doesn't touch the database. |
| `GET /version` | none | Running build info. |

## Better Auth routes used by the clients

| Route | Body / notes |
| --- | --- |
| `POST /api/auth/sign-up/email` | `{ email, password, name }`. Sets the session cookie. |
| `POST /api/auth/sign-in/email` | `{ email, password }`. Sets the session cookie. |
| `POST /api/auth/sign-in/social` | `{ provider: "google" \| "apple", idToken: { token, nonce? } }` (native) or `{ provider, callbackURL }` (web redirect flow). |
| `GET /api/auth/list-accounts` | The user's sign-in methods (`providerId`: `credential`, `google`, `apple`). |
| `POST /api/auth/sign-out` | Ends the session. |
| `GET /api/auth/get-session` | Current session and user. |
| `POST /api/auth/request-password-reset` | `{ email, redirectTo }`. |
| `GET /api/auth/reset-password/:token` | Link target from the email; redirects to `redirectTo?token=...`. |
| `POST /api/auth/reset-password` | `{ newPassword, token }`. |
| `POST /api/auth/change-password` | `{ currentPassword, newPassword, revokeOtherSessions }`. |
| `POST /api/auth/change-email` | `{ newEmail, callbackURL }`. |
| `GET /api/auth/verify-email` | Email-change link target; redirects to `callbackURL`. |
| `POST /api/auth/delete-user` | `{ password }`, or `{}` for social-only users with a fresh session. |
| `GET /api/auth/reference` | OpenAPI reference for all auth routes. Development only. |

Details: [Account flows](../authentication/account-flows.md), [Sign in with Google / Apple](../authentication/social-sign-in.md).

## `GET /version`

Public, no database, `Cache-Control: no-store`. Response:

```json
{
  "name": "mintsy-backend",
  "version": "1.0.0",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "buildTime": "2026-10-30T12:00:00Z",
  "revision": "mintsy-api-00042-abc",
  "env": "production",
  "startedAt": "2026-10-30T12:01:05.000Z",
  "uptimeSeconds": 3600
}
```

| Field | Source |
| --- | --- |
| `name`, `version` | `package.json` |
| `commit` | `GIT_SHA` build arg. In development, `git rev-parse --short HEAD` when available. Otherwise `null`. |
| `buildTime` | `BUILD_TIME` build arg, or `null`. |
| `revision` | Cloud Run's `K_REVISION`, or `null`. |
| `env` | `NODE_ENV`, `development` when unset. |
| `startedAt`, `uptimeSeconds` | The process. |

CI and the deploy job use `commit` to check that the deployed service runs the expected commit.
