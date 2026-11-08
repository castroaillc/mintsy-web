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
* Apple's one-time `authorizationCode` (from `expo-apple-authentication`, alongside the identity token) goes in the same call as `additionalData: { appleAuthorizationCode }`. Optional: see [Apple token revocation](#apple-token-revocation).

## Apple token revocation

App Review (guideline 5.1.1(v)) requires an app that offers Sign in with Apple and account deletion to revoke the user's Apple tokens when they delete their account. An identity token can't be revoked, so the server needs a refresh token, which only comes from exchanging the authorization code. `src/apple.ts`:

1. **Sign-in.** An `after` hook on `/sign-in/social` runs when the sign-in succeeded, `provider` is `apple` and the body has `additionalData.appleAuthorizationCode`. It exchanges the code at `https://appleid.apple.com/auth/token` (`grant_type=authorization_code`, `client_id` = the identity token's `aud`, i.e. the app variant's bundle ID, which must be in `APPLE_APP_BUNDLE_IDENTIFIER`). It checks that the `id_token` Apple returns has the same `sub` as the sign-in, then stores `refreshToken`, `accessToken`, `accessTokenExpiresAt` and `appleClientId` (the bundle ID) on the user's `apple` document in `account`. Codes are single use and expire after about 5 minutes. Without a code (older app builds), sign-in is unchanged, and a later sign-in without one keeps the stored token.
2. **Delete account.** `beforeDelete` calls `https://appleid.apple.com/auth/revoke` for each `apple` account of the user with the stored refresh token (`token_type_hint=refresh_token`), or the access token if that's all there is, and the stored `appleClientId` (fallback: the stored identity token's `aud`). It runs before Better Auth deletes the `account` documents.
3. **client_secret.** Both calls send an ES256 JWT made per request from `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (`iss` team ID, `sub` client ID, `aud` `https://appleid.apple.com`, `kid` key ID, 10-minute lifetime).

Everything is best effort: an Apple error, a timeout (5 s), an unusable code, a missing key or no stored token never fails the sign-in or the deletion. They're logged as `[apple] ...` warnings with the user id and Apple's error code, never a token. Without `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` the server logs a warning at startup and nothing is exchanged or revoked.

Users who signed in before the app sent the code have nothing stored until their next Apple sign-in with a code (the re-sign-in before deleting an account counts).

## Web flow (app.getmintsy.com)

Redirect flow: `authClient.signIn.social({ provider, callbackURL })`. Needs the client secrets. Redirect URIs:

| Provider                                        | Redirect URI                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Google (web client)                             | `https://app.getmintsy.com/api/auth/callback/google`, plus `http://localhost:3000/api/auth/callback/google` for local dev |
| Apple (Services ID, domain `app.getmintsy.com`) | `https://app.getmintsy.com/api/auth/callback/apple` (Apple doesn't accept localhost)                                      |

Apple POSTs the callback (`form_post`); Better Auth answers with a 302 to the same URL as a GET on the web host, where the `SameSite=Lax` state cookie is sent.

## Configuration

A provider is only configured when its client ID is set (`src/auth.ts`, `src/env.ts`). Otherwise the server logs a warning at startup and `sign-in/social` for it answers `404 PROVIDER_NOT_FOUND`. Local dev and CI run without any of these.

| Provider | Variables                                                                                                              | Accepted ID-token audiences                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Google   | `GOOGLE_CLIENT_ID` (web) and/or `GOOGLE_IOS_CLIENT_ID` (comma-separated); `GOOGLE_CLIENT_SECRET` for the web flow only | every configured Google client ID                                                                                         |
| Apple    | `APPLE_CLIENT_ID` (Services ID); `APPLE_CLIENT_SECRET` for the web flow only; `APPLE_APP_BUNDLE_IDENTIFIER`; `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` for token revocation | every bundle ID in `APPLE_APP_BUNDLE_IDENTIFIER` (default `com.getmintsy.app,com.getmintsy.app.dev,com.getmintsy.app.preview`) plus the Services ID |

## Errors

| Status and code                                       | Meaning                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `401 INVALID_TOKEN`                                   | Bad, expired or wrong-audience token.                              |
| `401 USER_EMAIL_NOT_FOUND`                            | The token has no email.                                            |
| `401 OAUTH_LINK_ERROR` (message `account not linked`) | An account with this email exists but can't be linked (see below). |
| `404 PROVIDER_NOT_FOUND`                              | The provider isn't configured on this server.                      |

## Account linking

`account.accountLinking` is enabled with trusted providers `google` and `apple`. A sign-in whose email matches an existing user is linked to that user **only if the existing user's email is verified** (Better Auth's `requireLocalEmailVerified`, default on). This stops someone pre-registering a password account on another person's address and later sharing their Google/Apple account.

Email sign-up here doesn't verify addresses, so most password accounts get `OAUTH_LINK_ERROR` instead; those users sign in with their password. Apple private-relay addresses (`...@privaterelay.appleid.com`) never match, so they create a new user.

## One-time setup

Client IDs, bundle IDs, the team ID and the key ID aren't secret (plain Cloud Run env vars); `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_SECRET` and `APPLE_PRIVATE_KEY` are secrets.

**Google Cloud console → APIs & Services**

* Configure the OAuth consent screen.
* Credentials → Create OAuth client ID as **Web application** (`GOOGLE_CLIENT_ID`, secret `GOOGLE_CLIENT_SECRET`, redirect URIs above).
* Create one as **iOS** with bundle ID `com.getmintsy.app` (`GOOGLE_IOS_CLIENT_ID`). iOS clients are per bundle ID, so dev builds (`com.getmintsy.app.dev`) and preview builds (`com.getmintsy.app.preview`) each need their own iOS client; `GOOGLE_IOS_CLIENT_ID` takes a comma-separated list.

**Apple Developer → Identifiers**

* Enable **Sign in with Apple** on the App IDs `com.getmintsy.app`, `com.getmintsy.app.dev` and `com.getmintsy.app.preview`.
* Create a **Services ID** (`APPLE_CLIENT_ID`) with Sign in with Apple enabled: domain `app.getmintsy.com`, return URL `https://app.getmintsy.com/api/auth/callback/apple` (web flow only).
* For the web flow only: Keys → create a key with Sign in with Apple and generate the client-secret JWT (`APPLE_CLIENT_SECRET`, expires after at most 6 months).
* For token revocation: **Keys → +**, enable **Sign in with Apple** and configure it with the primary App ID `com.getmintsy.app`. Download the `.p8` (only possible once) and note its **Key ID**. Set `APPLE_KEY_ID` to the Key ID and `APPLE_PRIVATE_KEY` to the full `.p8` contents (a secret). `APPLE_TEAM_ID` defaults to `9496L7QUB2`. The dev and preview App IDs must be grouped with the primary App ID under Sign in with Apple, or Apple rejects their codes with `invalid_client`.

**Apple Developer → Services → Sign in with Apple for Email Communication**

* Register the sending domain (`getmintsy.com`, or the Resend subdomain) and/or the `EMAIL_FROM` address, so email reaches `@privaterelay.appleid.com` addresses. The domain's SPF must pass (Resend's records).
