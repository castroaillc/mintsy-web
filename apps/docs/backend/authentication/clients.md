# How clients authenticate

## iPhone app

The native Swift app ([iOS](../../services/ios.md)) talks to the API host directly. Dev builds default to `http://localhost:4000` and production builds to `https://api.getmintsy.com`. Preview builds have no default: set the URL (for example the `mintsy-api-preview` service) in `apps/ios/Config/API.xcconfig`.

* It calls Better Auth's REST routes itself and keeps the session cookie in a Keychain cookie jar, updated from every `Set-Cookie`.
* Every `/api/auth/*` call sends `Origin: <scheme>://`. Schemes: `mintsy` (production builds), `mintsy-preview` (preview builds) and `mintsy-dev` (dev builds). All three are trusted origins in `src/auth.ts`, on every service.
* GraphQL requests send the cookie as a `Cookie` header.
* It only signs in with email and password so far. Social sign-in and the email-link flows (`<scheme>://reset-password`, `<scheme>://email-changed`) aren't built in the app yet, but the backend supports them as described in [Sign in with Google / Apple](social-sign-in.md) and [Account flows](account-flows.md).

The backend still loads the `@better-auth/expo` plugin, which also accepts an `expo-origin: <scheme>://` header in place of `Origin`. That was for the retired Expo app; the iOS app doesn't use it.

Example (what the app's auth client does):

```http
POST /api/auth/sign-in/email
Content-Type: application/json
Origin: mintsy://

{"email":"you@example.com","password":"..."}
```

```http
POST /graphql
Content-Type: application/json
Cookie: __Secure-better-auth.session_token=...

{"query":"{ me { id premium { active } } }"}
```

::: info
The client-side code is in `apps/ios/Mintsy/Auth/AuthService.swift`, `CookieJar.swift` and `apps/ios/Mintsy/Networking/GraphQLClient.swift`. This page only covers what the backend expects.
:::

## Web app

The Next.js web app at app.getmintsy.com never calls the API from the browser. Next.js rewrites:

| Browser requests                            | Proxied to                                  |
| ------------------------------------------- | ------------------------------------------- |
| `https://app.getmintsy.com/api/auth/:path*` | `https://api.getmintsy.com/api/auth/:path*` |
| `https://app.getmintsy.com/graphql`         | `https://api.getmintsy.com/graphql`         |

So the session cookie is a first-party, host-only cookie on `app.getmintsy.com`: `__Secure-better-auth.session_token`, `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`. There's no `crossSubDomainCookies`.

* The proxy sends `X-Forwarded-Host: app.getmintsy.com`, so Better Auth uses `https://app.getmintsy.com/api/auth` as its base URL for that request. OAuth redirect URIs, Apple's form\_post redirect and email links stay on the web host.
* `https://app.getmintsy.com` is always a trusted origin and allowed by CORS (`http://localhost:3000` too outside production; both come from `env.webOrigins`), on every route. Redirect targets such as `https://app.getmintsy.com/reset-password` and `https://app.getmintsy.com/profile/settings` pass.
* Google and Apple on the web use the redirect flow (`authClient.signIn.social({ provider, callbackURL })`), which needs `GOOGLE_CLIENT_SECRET` / `APPLE_CLIENT_SECRET`.
* Covered by `test/web-auth.test.ts`.

## Other HTTP clients (curl, scripts)

Use a cookie jar, and send a trusted `Origin` (for example `Origin: mintsy://`) on auth calls:

```sh
curl -s -c jar.txt http://localhost:4000/api/auth/sign-up/email -H 'Content-Type: application/json' \
  -H 'Origin: mintsy://' -d '{"email":"me@example.com","password":"password1234","name":"Me"}'
curl -s -b jar.txt http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{"query":"{ me { email } }"}'
```

An untrusted origin (for example `Origin: https://evil.example.com`, or `expo-origin: evil://` through the Expo plugin) gets 403.
