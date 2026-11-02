# Deployment

Production runs on **Google Cloud Run** and is served at **https://api.getmintsy.com**.

| | |
| --- | --- |
| Service | `mintsy-api` |
| Region / project | `us-central1` / `mintsy-prod` |
| Image registry | Artifact Registry `us-central1-docker.pkg.dev/mintsy-prod/mintsy/api`, tagged with the commit SHA |
| Database | MongoDB Atlas (Free cluster), database `mintsy`, until the [split](#splitting-the-database) to `mintsy_app` + `mintsy_studio` on a new cluster |
| Media | `gs://mintsy-media` |

{% hint style="danger" %}
**Pushing to `main` deploys production.** The `deploy` job in `.github/workflows/backend.yml` runs on every push to `main` that touches `apps/backend/**` or the workflow, once the checks pass. That includes documentation-only changes under `apps/backend/docs/`, and merging a pull request into `main`. Get approval before you push or merge to `main`.
{% endhint %}

## Which repository deploys production

There are two repositories with backend code:

* `castroaillc/mintsy-web`: this monorepo (`apps/backend`). **Production deploys from its `main`.**
* `castroaillc/mintsy-backend`: the original standalone backend repo, now **frozen**. Production used to deploy from it.

Commit `7e3a2ff` ("backend: add GET /version and enable Cloud Run deploy from mintsy-web") enabled the deploy job (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`); before it, the job was disabled with `if: false`. The workflow notes that Workload Identity only trusts `castroaillc/mintsy-web` on `refs/heads/main`. Since 2026-10-31 the "Deploy to Cloud Run" job has completed successfully from `castroaillc/mintsy-web` `main`, and `GET https://api.getmintsy.com/version` reports `castroaillc/mintsy-web` commits.

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
| Plain env vars | `BETTER_AUTH_URL=https://api.getmintsy.com`, `MONGODB_DB=mintsy` with `MONGODB_CATALOG_DB` unset (after the split: `MONGODB_DB=mintsy_app`, `MONGODB_CATALOG_DB=mintsy_studio`), `CORS_ORIGINS=` (empty; the web origin is built in) |
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

## Splitting the database

Moves production from the flat `mintsy` database to a **new, empty cluster** with `mintsy_app` (backend: readWrite) and `mintsy_studio` (studio and admin: readWrite; backend: read). See [MongoDB collections](../architecture/mongodb-collections.md).

{% hint style="warning" %}
**No data is migrated.** The new cluster starts empty, and old accounts and data aren't carried over: users, sessions, entitlements, My List, watch progress and push tokens stay on the old cluster, so everyone has to sign up again. RevenueCat customers are keyed by the old user ids (`app_user_id` is the Better Auth user id), so a subscriber's new account has no Premium until the purchase moves to the new id. The catalog starts blank too: `books` returns an empty list until books are published from the admin dashboard.
{% endhint %}

{% hint style="danger" %}
**Change the secret behind `MONGODB_URI`, `MONGODB_DB` and `MONGODB_CATALOG_DB` together, in one revision, and only after the code that reads `MONGODB_CATALOG_DB` is live.** Older code would look for `books` in `mintsy_app` and never see what admin publishes. `MONGODB_URI` is bound as `:latest` and Cloud Run resolves a `:latest` secret when an instance starts, so adding a version to that secret would move new instances to the new cluster on their own, with the old database names. Use a new secret, pinned to a version.
{% endhint %}

### Atlas users

| User | Roles | Used by |
| --- | --- | --- |
| Backend | `readWrite@mintsy_app`, `read@mintsy_studio` | Cloud Run `MONGODB_URI` |
| Studio | `readWrite@mintsy_studio` | studio worker, admin dashboard, `pnpm seed:catalog` |

### Order

1. Deploy the code with the env unchanged. A deploy only swaps the image, so it logs `Database: mintsy (catalog: mintsy)` and serves as before.
2. Create the new cluster, the users above and network access. Don't change anything on the old cluster.
3. Create a **new** secret holding the backend user's connection string, not a new version of `MONGODB_URI`, and grant the runtime service account access to it. Nothing uses it yet.
   ```sh
   printf '%s' '<backend user connection string>' | gcloud secrets create MONGODB_URI_SPLIT --project mintsy-prod --data-file=-
   SA=$(gcloud run services describe mintsy-api --region us-central1 --project mintsy-prod \
     --format 'value(spec.template.spec.serviceAccountName)')
   [ -z "$SA" ] && SA="$(gcloud projects describe mintsy-prod --format 'value(projectNumber)')-compute@developer.gserviceaccount.com"
   gcloud secrets add-iam-policy-binding MONGODB_URI_SPLIT --project mintsy-prod \
     --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
   ```
4. Switch, in one command, so all three change in one revision:
   ```sh
   gcloud run services update mintsy-api --region us-central1 --project mintsy-prod \
     --update-secrets MONGODB_URI=MONGODB_URI_SPLIT:1 \
     --update-env-vars MONGODB_DB=mintsy_app,MONGODB_CATALOG_DB=mintsy_studio
   ```
5. Check the new revision's log for `Database: mintsy_app (catalog: mintsy_studio)` and no `Unauthorized`.
6. Check that `books` returns an empty list, a new account can sign up and sign in, and a RevenueCat test event answers 200.
7. Point studio and admin at `mintsy_studio` with the studio user and start them. The worker creates the catalog indexes. Publish the catalog from admin.

### Rollback

The old cluster is left untouched and is the only rollback, so keep it, and the `MONGODB_URI` secret, exactly as they are. To go back, route traffic to the previous revision, which is still bound to that secret and the old env (see [Rolling back](#rolling-back)). Nothing copies data between the clusters: anything written to the new cluster, including new accounts, stays behind.

## Rolling back

TODO: confirm the preferred rollback procedure. Cloud Run keeps earlier revisions, so routing traffic back to the previous revision (`gcloud run services update-traffic mintsy-api --to-revisions <revision>=100 --region us-central1 --project mintsy-prod`) is the usual option, but no rollback is documented in the repo.
