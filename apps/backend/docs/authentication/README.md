# Authentication

Accounts and sessions are handled by [Better Auth](https://www.better-auth.com), configured in `src/auth.ts` and mounted at `/api/auth/*`. GraphQL reads the same session from the request's cookie (`src/graphql/context.ts`). There are no API keys or bearer tokens for clients.

## What's enabled

| Feature | Config |
| --- | --- |
| Email and password | `emailAndPassword.enabled`. Sign-up doesn't send a verification email. |
| Password reset by email | 1-hour single-use tokens; a reset revokes every session. |
| Change password | Better Auth default route. |
| Change email | Confirmation link to the new address, notice to the old one. |
| Delete account | Password required for users who have one; fresh session for social-only users. |
| Sign in with Google / Apple | Only when the client IDs are configured. See [Sign in with Google / Apple](social-sign-in.md). |
| Account linking | Google / Apple sign-ins link to an existing user with the same **verified** email. |
| Expo plugin (`@better-auth/expo`) | Lets the native app use deep-link schemes as origins and redirect targets. |
| OpenAPI plugin | Route reference at `/api/auth/reference`, development only. |

Storage: MongoDB adapter on the shared client (`user`, `session`, `account`, `verification` collections). Transactions are why MongoDB must be a replica set.

## Sessions

* Better Auth sets a session cookie, `better-auth.session_token`. When `BETTER_AUTH_URL` is `https`, cookies get the `__Secure-` prefix and the `Secure` flag (`__Secure-better-auth.session_token`).
* The session's user id is the id used everywhere else: `userId` in every collection and RevenueCat's `app_user_id`.
* GraphQL resolves the session per request with `auth.api.getSession({ headers })`. No cookie or an invalid one = signed out (`ctx.session` is `null`).
* Session lifetime and refresh use Better Auth's defaults; `src/auth.ts` doesn't override them. TODO: confirm the defaults for the installed Better Auth version if a client needs exact numbers.

## Trusted origins

Better Auth rejects requests (403) whose origin, `redirectTo` or `callbackURL` isn't trusted. Trusted:

| Origin | When |
| --- | --- |
| `CORS_ORIGINS` entries | always |
| `https://app.getmintsy.com` | always (web app) |
| `http://localhost:3000` | outside production (`next dev`) |
| `mintsy://`, `mintsy-dev://` | always (production and dev builds of the iPhone app) |
| `exp://`, `exp://**` | outside production (Expo Go / dev server) |
| `https://appleid.apple.com` | while Apple sign-in is configured (Apple's form_post callback, web only) |

The native app identifies its origin with the `expo-origin` header (for example `expo-origin: mintsy://`), set by the Better Auth Expo client.

## Base URL

The base URL Better Auth uses for links and OAuth redirects is dynamic:

* `allowedHosts`: the `BETTER_AUTH_URL` host plus the web hosts with the same scheme.
* `protocol`: fixed to `BETTER_AUTH_URL`'s, so cookie names never change.
* `fallback`: `BETTER_AUTH_URL`.
* `advanced.trustedProxyHeaders: true`: `X-Forwarded-Host` picks one of the allowed hosts.

A request proxied by the web app (`X-Forwarded-Host: app.getmintsy.com`) gets `https://app.getmintsy.com/api/auth` as its base URL, so OAuth redirect URIs and email links stay on the web host. Anything else (the iPhone app, the `*.run.app` URL, a forged host) uses `BETTER_AUTH_URL`.

## Hooks

`src/auth.ts` adds two hooks on top of Better Auth:

* **Before `/delete-user`**: users with a password must send it (`400 PASSWORD_REQUIRED` otherwise); users without one need a session under 10 minutes old (`403 REAUTH_REQUIRED` otherwise).
* **After `/verify-email`**: opening an email-change link in a browser must not create a session or put a session token in an app deep link, so the hook revokes the new session and drops `Set-Cookie`.

Plus `deleteUser.beforeDelete` / `afterDelete`, which remove the user's data. See [Account flows](account-flows.md).

## Email

Reset and email-change messages go through Resend (`src/email.ts`) in the background (`advanced.backgroundTasks`), so requests don't wait on delivery and a reset for an unknown address takes as long as one for a known address. See [Email](../features/email.md).
