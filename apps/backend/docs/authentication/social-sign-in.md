# Sign in with Google / Apple

## Native flow (iPhone app)

The app uses the **ID-token flow**, with no browser redirect. It gets an ID token from `@react-native-google-signin/google-signin` or `expo-apple-authentication`, then calls:

```ts
authClient.signIn.social({ provider, idToken: { token, nonce?, accessToken? } })
// → POST /api/auth/sign-in/social
```

The response and session cookie are the same as email sign-in (`{ redirect: false, token, user }`).

* Apple's `nonce` is the raw nonce (its SHA-256 went to Apple); Better Auth accepts the raw or hashed value.
* Apple only sends the user's name on the first authorization, so the app should pass it on that call as `idToken.user: { name: { firstName, lastName } }`.

## Web flow (app.getmintsy.com)

Redirect flow: `authClient.signIn.social({ provider, callbackURL })`. Needs the client secrets. Redirect URIs:

| Provider | Redirect URI |
| --- | --- |
| Google (web client) | `https://app.getmintsy.com/api/auth/callback/google`, plus `http://localhost:3000/api/auth/callback/google` for local dev |
| Apple (Services ID, domain `app.getmintsy.com`) | `https://app.getmintsy.com/api/auth/callback/apple` (Apple doesn't accept localhost) |

Apple POSTs the callback (`form_post`); Better Auth answers with a 302 to the same URL as a GET on the web host, where the `SameSite=Lax` state cookie is sent.

## Configuration

A provider is only configured when its client ID is set (`src/auth.ts`, `src/env.ts`). Otherwise the server logs a warning at startup and `sign-in/social` for it answers `404 PROVIDER_NOT_FOUND`. Local dev and CI run without any of these.

| Provider | Variables | Accepted ID-token audiences |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID` (web) and/or `GOOGLE_IOS_CLIENT_ID` (comma-separated); `GOOGLE_CLIENT_SECRET` for the web flow only | every configured Google client ID |
| Apple | `APPLE_CLIENT_ID` (Services ID); `APPLE_CLIENT_SECRET` for the web flow only; `APPLE_APP_BUNDLE_IDENTIFIER` | every bundle ID in `APPLE_APP_BUNDLE_IDENTIFIER` (default `com.getmintsy.app,com.getmintsy.app.dev`) plus the Services ID |

## Errors

| Status and code | Meaning |
| --- | --- |
| `401 INVALID_TOKEN` | Bad, expired or wrong-audience token. |
| `401 USER_EMAIL_NOT_FOUND` | The token has no email. |
| `401 OAUTH_LINK_ERROR` (message `account not linked`) | An account with this email exists but can't be linked (see below). |
| `404 PROVIDER_NOT_FOUND` | The provider isn't configured on this server. |

## Account linking

`account.accountLinking` is enabled with trusted providers `google` and `apple`. A sign-in whose email matches an existing user is linked to that user **only if the existing user's email is verified** (Better Auth's `requireLocalEmailVerified`, default on). This stops someone pre-registering a password account on another person's address and later sharing their Google/Apple account.

Email sign-up here doesn't verify addresses, so most password accounts get `OAUTH_LINK_ERROR` instead; those users sign in with their password. Apple private-relay addresses (`...@privaterelay.appleid.com`) never match, so they create a new user.

## One-time setup

Client IDs and bundle IDs aren't secret (plain Cloud Run env vars); `GOOGLE_CLIENT_SECRET` and `APPLE_CLIENT_SECRET` are secrets.

**Google Cloud console → APIs & Services**

* Configure the OAuth consent screen.
* Credentials → Create OAuth client ID as **Web application** (`GOOGLE_CLIENT_ID`, secret `GOOGLE_CLIENT_SECRET`, redirect URIs above).
* Create one as **iOS** with bundle ID `com.getmintsy.app` (`GOOGLE_IOS_CLIENT_ID`). iOS clients are per bundle ID, so dev builds (`com.getmintsy.app.dev`) need a second iOS client; `GOOGLE_IOS_CLIENT_ID` takes a comma-separated list.

**Apple Developer → Identifiers**

* Enable **Sign in with Apple** on the App IDs `com.getmintsy.app` and `com.getmintsy.app.dev`.
* Create a **Services ID** (`APPLE_CLIENT_ID`) with Sign in with Apple enabled: domain `app.getmintsy.com`, return URL `https://app.getmintsy.com/api/auth/callback/apple` (web flow only).
* For the web flow only: Keys → create a key with Sign in with Apple and generate the client-secret JWT (`APPLE_CLIENT_SECRET`, expires after at most 6 months).

**Apple Developer → Services → Sign in with Apple for Email Communication**

* Register the sending domain (`getmintsy.com`, or the Resend subdomain) and/or the `EMAIL_FROM` address, so email reaches `@privaterelay.appleid.com` addresses. The domain's SPF must pass (Resend's records).
