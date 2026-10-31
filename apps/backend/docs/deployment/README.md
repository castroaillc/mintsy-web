# Deployment

Production runs on **Google Cloud Run** and is served at **https://api.getmintsy.com**.

| | |
| --- | --- |
| Service | `mintsy-api` |
| Region / project | `us-central1` / `mintsy-prod` |
| Image registry | Artifact Registry `us-central1-docker.pkg.dev/mintsy-prod/mintsy/api`, tagged with the commit SHA |
| Database | MongoDB Atlas (Free cluster), database `mintsy` |
| Media | `gs://mintsy-media` |

{% hint style="danger" %}
**Pushing to `main` deploys production.** The `deploy` job in `.github/workflows/backend.yml` runs on every push to `main` that touches `apps/backend/**` or the workflow, once the checks pass. That includes documentation-only changes under `apps/backend/docs/`, and merging a pull request into `main`. Get approval before you push or merge to `main`.
{% endhint %}

## Which repository deploys production

There are two repositories with backend code:

* `castroaillc/mintsy-web`: this monorepo (`apps/backend`). **Production deploys from its `main`.**
* `castroaillc/mintsy-backend`: the original standalone backend repo, now **frozen**. Production used to deploy from it.

Commit `7e3a2ff` ("backend: add GET /version and enable Cloud Run deploy from mintsy-web") enabled the deploy job (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`); before it, the job was disabled with `if: false`. The workflow notes that Workload Identity only trusts `castroaillc/mintsy-web` on `refs/heads/main`. Since 2026-10-31 the "Deploy to Cloud Run" job has completed successfully from `castroaillc/mintsy-web` `main`, and `GET https://api.getmintsy.com/version` reports `castroaillc/mintsy-web` commits.

The "Deploy (production)" section of the backend `README.md` still describes the disabled state and needs updating.

{% hint style="warning" %}
TODO: confirm that `castroaillc/mintsy-backend` can no longer deploy (its workflow disabled or its Workload Identity binding removed). Until then, a push to its `main` could still replace production with an older build.
{% endhint %}

## What a deploy does

The `deploy` job (needs `check` and `integration` to pass):

1. Authenticates to Google Cloud with Workload Identity Federation as `github-deployer@mintsy-prod.iam.gserviceaccount.com`. No key is stored in GitHub.
2. Builds the image from the repository root with `GIT_SHA` and `BUILD_TIME` build args, and pushes `.../mintsy/api:<sha>`.
3. `gcloud run deploy mintsy-api --image .../mintsy/api:<sha>`. Only the image changes; env vars, secrets and scaling stay as configured on the service.
4. Health check: `GET <service URL>/health` with retries.
5. Version check: `GET <service URL>/version` must report `"commit":"<sha>"` within about 30 seconds, or the job fails.

Check what's running at any time:

```sh
curl -s https://api.getmintsy.com/version
```

## Production configuration

Configured on the Cloud Run service, not in the repo.

| Kind | Variables |
| --- | --- |
| Plain env vars | `BETTER_AUTH_URL=https://api.getmintsy.com`, `MONGODB_DB=mintsy`, `CORS_ORIGINS=` (empty; the web origin is built in) |
| Secrets (Secret Manager) | `MONGODB_URI`, `BETTER_AUTH_SECRET`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_SECRET_API_KEY`, `RESEND_API_KEY`, optionally `EXPO_ACCESS_TOKEN` |
| Optional plain env vars | `EMAIL_FROM`, `SIGNED_MEDIA=true`, `MEDIA_BUCKET` |
| Sign in with Google / Apple | Plain: `GOOGLE_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `APPLE_CLIENT_ID`, optionally `APPLE_APP_BUNDLE_IDENTIFIER`. Secrets: `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_SECRET` (both optional, needed for the web app's redirect flow). |
| Set by the platform | `PORT=8080`, `K_REVISION`; `NODE_ENV=production` comes from the image |

New secrets: create them in Secret Manager, grant the Cloud Run service account `roles/secretmanager.secretAccessor`, then `gcloud run services update mintsy-api --region us-central1 --project mintsy-prod --update-secrets NAME=NAME:latest`. The backend `README.md` has full examples.

## Production behaviour (`NODE_ENV=production`)

* The OpenAPI auth reference (`/api/auth/reference`) is disabled.
* GraphQL introspection and Apollo Sandbox are off.
* `exp://` dev origins and `http://localhost:3000` aren't trusted.
* A missing `RESEND_API_KEY` is logged as an error.

## Rolling back

TODO: confirm the preferred rollback procedure. Cloud Run keeps earlier revisions, so routing traffic back to the previous revision (`gcloud run services update-traffic mintsy-api --to-revisions <revision>=100 --region us-central1 --project mintsy-prod`) is the usual option, but no rollback is documented in the repo.
