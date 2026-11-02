# Paused: the mintsy web app

`getmintsy.com` currently serves only the public site in `src/app` (`/`, `/privacy`, `/support`). The web app's
routes, its API proxies and its root layout live here so Next.js doesn't build or serve them. This folder is
excluded in `tsconfig.json` and `eslint.config.mjs`. `src/components` and `src/lib` were left in place.

This folder mirrors `src/`. To restore, from `apps/web/src`:

```sh
mv "paused-app/app/(shell)" "paused-app/app/(auth)" paused-app/app/api paused-app/app/graphql app/
mv paused-app/proxy.ts proxy.ts
```

Then:

1. `app/(shell)/book/[id]/book-view.tsx` has to be written; it was never committed, and the build fails without it.
2. Decide what serves `/`: `app/page.tsx` (landing) and `app/(shell)/page.tsx` (Home) clash, and `proxy.ts` redirects `/`.
3. Merge `paused-app/app/layout.tsx` (Providers, `.dk`) and `paused-app/app/globals.css` (Desktop tokens) with the public
   site's. `--color-line` differs between the two, and the public site's CSS only scans its own files (`@source` in `app/globals.css`).
4. Put back `skipTrailingSlashRedirect: true` in `next.config.ts` (Better Auth's `/reset-password/?token=…` needs it).
5. Remove the `src/paused-app` entries from `tsconfig.json` and `eslint.config.mjs`.
6. Backend: `https://getmintsy.com` has to be added to `WEB_ORIGINS` in `apps/backend/src/env.ts` if the app runs on this domain.
7. Update the privacy policy for the web app (browser session cookie, RevenueCat Web Billing).
