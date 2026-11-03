# Web (`mintsy-web/apps/web`)

The static site at `getmintsy.com`: the landing page, `/privacy` and `/support`. It's Next.js with Tailwind, and every route is prerendered, so it doesn't call the API.

The browse, stream and checkout web app is paused in `src/paused-app/`, which has a README on restoring it.

| Path | What it is |
|---|---|
| `src/app/page.tsx` | Landing page |
| `src/app/privacy/page.tsx` | Privacy policy. Text changes need owner approval. |
| `src/app/support/page.tsx` | Support page. The mobile app links here. |
| `src/site.ts` | Site-wide values |

## Deploying

- Vercel project `mintsy-web` (team `castro-ais-projects`), Root Directory `apps/web`, Node 24, `ENABLE_EXPERIMENTAL_COREPACK=1`.
- It's connected to GitHub: a push to `main` of `castroaillc/mintsy-web` deploys production, and any other branch gets a preview. `apps/web/vercel.json` skips builds when `apps/web`, `packages/` and the root workspace files haven't changed. If a build fails, the current site stays up.

## DNS

DNS is at Network Solutions.

| Record | Value | Notes |
|---|---|---|
| `@` A | `76.76.21.21` | Vercel |
| `www` CNAME | `cname.vercel-dns.com` | Redirects to the apex |
| `api` CNAME | `ghs.googlehosted.com` | The API on Cloud Run. Don't touch it from web work. |
| `@` MX, SPF | Google Workspace | `support@getmintsy.com` delivers through Workspace |
| `send`, `rsend`, `resend._domainkey`, `_dmarc` | Resend | Transactional email |
