# How clients authenticate

## iPhone app

The Expo app talks to `https://api.getmintsy.com` directly.

* It uses Better Auth's React client with the Expo plugin (`@better-auth/expo/client`). The plugin stores the session cookie in SecureStore and sends `expo-origin: <scheme>://` so the backend trusts the request.
* Schemes: `mintsy` (production builds) and `mintsy-dev` (dev builds). Both are trusted origins in `src/auth.ts`.
* GraphQL requests send the cookie explicitly as a `Cookie` header (from `authClient.getCookie()`), with `credentials: "omit"`.
* Sign in with Google / Apple uses the native ID-token flow: the app gets an ID token on the device and posts it to `/api/auth/sign-in/social`. No browser redirect.
* Email links (password reset, email change) redirect to app deep links: `<scheme>://reset-password` and `<scheme>://email-changed`.

Example (what the app's auth client does):

```http
POST /api/auth/sign-in/email
Content-Type: application/json
expo-origin: mintsy://

{"email":"you@example.com","password":"..."}
```

```http
POST /graphql
Content-Type: application/json
Cookie: __Secure-better-auth.session_token=...

{"query":"{ me { id premium { active } } }"}
```

{% hint style="info" %}
The client-side code lives in the mobile repo (`mobile-app/src/lib/auth-client.ts`, `src/lib/graphql.ts`). This page only covers what the backend expects.
{% endhint %}

## Web app

The Next.js web app at app.getmintsy.com never calls the API from the browser. Next.js rewrites:

| Browser requests | Proxied to |
| --- | --- |
| `https://app.getmintsy.com/api/auth/:path*` | `https://api.getmintsy.com/api/auth/:path*` |
| `https://app.getmintsy.com/graphql` | `https://api.getmintsy.com/graphql` |

So the session cookie is a first-party, host-only cookie on `app.getmintsy.com`: `__Secure-better-auth.session_token`, `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`. There's no `crossSubDomainCookies`.

* The proxy sends `X-Forwarded-Host: app.getmintsy.com`, so Better Auth uses `https://app.getmintsy.com/api/auth` as its base URL for that request. OAuth redirect URIs, Apple's form_post redirect and email links stay on the web host.
* `https://app.getmintsy.com` is always a trusted origin and allowed by CORS (`http://localhost:3000` too outside production). Redirect targets such as `https://app.getmintsy.com/reset-password` and `https://app.getmintsy.com/profile/settings` pass.
* Google and Apple on the web use the redirect flow (`authClient.signIn.social({ provider, callbackURL })`), which needs `GOOGLE_CLIENT_SECRET` / `APPLE_CLIENT_SECRET`.
* Covered by `test/web-auth.test.ts`.

## Other HTTP clients (curl, scripts)

Use a cookie jar, and send `expo-origin: mintsy://` (or an `Origin` that's trusted) on auth calls:

```sh
curl -s -c jar.txt http://localhost:4000/api/auth/sign-up/email -H 'Content-Type: application/json' \
  -H 'expo-origin: mintsy://' -d '{"email":"me@example.com","password":"password1234","name":"Me"}'
curl -s -b jar.txt http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{"query":"{ me { email } }"}'
```

An untrusted origin (for example `expo-origin: evil://` or `Origin: https://evil.example.com`) gets 403.
