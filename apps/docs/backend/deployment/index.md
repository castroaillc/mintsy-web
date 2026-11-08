# Deployment

Production runs on **Google Cloud Run** and is served at **https://api.getmintsy.com**.

|                  |                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Service          | `mintsy-api`                                                                                                                                     |
| Region / project | `us-central1` / `mintsy-prod`                                                                                                                    |
| Image registry   | Artifact Registry `us-central1-docker.pkg.dev/mintsy-prod/mintsy/api`, tagged with the commit SHA                                                |
| Database         | MongoDB Atlas (Free cluster), database `mintsy`, until the [split](./#splitting-the-database) to `mintsy_app` + `mintsy_studio` on a new cluster |
| Media            | `gs://mintsy-media`                                                                                                                              |

::: danger
**Pushing to `main` deploys production.** The `deploy` job in `.github/workflows/backend.yml` runs on every push to `main` that touches `apps/backend/**` or the workflow, once the checks pass. That includes a change to `apps/backend/README.md` alone, and merging a pull request into `main`. Get approval before you push or merge to `main`.
:::

## Which repository deploys production

**Production deploys only from pushes to `main` of `castroaillc/mintsy-web`**, this monorepo (`apps/backend`).

Commit `7e3a2ff` ("backend: add GET /version and enable Cloud Run deploy from mintsy-web") enabled the deploy job (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`); before it, the job was disabled with `if: false`. The workflow notes that Workload Identity only trusts `castroaillc/mintsy-web` on `refs/heads/main`. Since 2026-10-31 the "Deploy to Cloud Run" job has completed successfully from `castroaillc/mintsy-web` `main`, and `GET https://api.getmintsy.com/version` reports `castroaillc/mintsy-web` commits.

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

## Preview deploys

The Cloud Run service `mintsy-api-preview` (same project and region) runs the same image with its own env vars and secrets: database `mintsy_app_preview`, read-only `mintsy_studio`, and its own auth secret. It deploys only when someone asks, and never from a push:

```sh
gh workflow run backend.yml --repo castroaillc/mintsy-web --ref main -f preview_ref=<branch, tag or full commit SHA>
```

Always run it from `main`. Workload Identity trusts only `refs/heads/main`, and the `deploy-preview` job doesn't run from any other ref. `preview_ref` chooses the code to build, so a branch can be tried on preview before it reaches `main`. Leaving it empty runs CI only, with no deploy.

The `deploy-preview` job:

1. Checks out `preview_ref` and builds the image from the repository root, before it has any Google credentials.
2. Authenticates as `github-deployer`, then pushes `.../mintsy/api:<sha>`.
3. Runs `gcloud run services update mintsy-api-preview --image .../mintsy/api:<sha>`. Only the image changes; env vars, secrets and scaling stay as configured on the service. If the service doesn't exist, this fails rather than creating it.
4. Runs the health and version checks against the preview service's URL, as in production.

The `smoke-preview` job then runs `scripts/smoke-test.sh` from `preview_ref` against the preview URL, with `SMOKE_NO_WEB_ORIGIN=1`. It has no Google credentials, refuses any URL that isn't the preview service's, and waits 60 seconds first, because the script can run at most once a minute. A failure here leaves the new image serving.

The `check` and `integration` jobs also run on a manual run, but they test `main`, not `preview_ref`, and they don't gate the preview deploy. A preview run can show red from `main` alone, or green with a `preview_ref` that wouldn't pass them.

Nothing in a preview run can start the production `deploy` job, which requires a push to `main`.

## Production configuration

Configured on the Cloud Run service, not in the repo.

| Kind                        | Variables                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plain env vars              | `BETTER_AUTH_URL=https://api.getmintsy.com`, `MONGODB_DB=mintsy` with `MONGODB_CATALOG_DB` unset (after the split: `MONGODB_DB=mintsy_app`, `MONGODB_CATALOG_DB=mintsy_studio`), `CORS_ORIGINS=` (empty; the web origin is built in) |
| Secrets (Secret Manager)    | `MONGODB_URI`, `BETTER_AUTH_SECRET`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_SECRET_API_KEY`, `RESEND_API_KEY`, optionally `EXPO_ACCESS_TOKEN`                                                                                        |
| Optional plain env vars     | `EMAIL_FROM`, `SIGNED_MEDIA=true`, `MEDIA_BUCKET`                                                                                                                                                                                    |
| Sign in with Google / Apple | Plain: `GOOGLE_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `APPLE_CLIENT_ID`, optionally `APPLE_APP_BUNDLE_IDENTIFIER`. Secrets: `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_SECRET` (both optional, needed for the web app's redirect flow). Apple token revocation (needed for App Review): plain `APPLE_KEY_ID` (and `APPLE_TEAM_ID` if not `9496L7QUB2`), secret `APPLE_PRIVATE_KEY`. |
| Set by the platform         | `PORT=8080`, `K_REVISION`; `NODE_ENV=production` comes from the image                                                                                                                                                                |

New secrets: create them in Secret Manager, grant the Cloud Run service account `roles/secretmanager.secretAccessor`, then `gcloud run services update mintsy-api --region us-central1 --project mintsy-prod --update-secrets NAME=NAME:latest`. Full examples: [Premium and RevenueCat](../features/premium.md#production-setup), [Email](../features/email.md#one-time-resend-setup).

## Production behaviour (`NODE_ENV=production`)

* The OpenAPI auth reference (`/api/auth/reference`) is disabled.
* GraphQL introspection and Apollo Sandbox are off.
* `exp://` dev origins and `http://localhost:3000` aren't trusted.
* A missing `RESEND_API_KEY` is logged as an error.

## Splitting the database

Moves production from the flat `mintsy` database to a **new, empty cluster** with `mintsy_app` (backend: readWrite) and `mintsy_studio` (studio and admin: readWrite; backend: read). See [MongoDB collections](../architecture/mongodb-collections.md).

::: warning
**No data is migrated.** The new cluster starts empty, and old accounts and data aren't carried over: users, sessions, entitlements, My List, watch progress and push tokens stay on the old cluster, so everyone has to sign up again. RevenueCat customers are keyed by the old user ids (`app_user_id` is the Better Auth user id), so a subscriber's new account has no Premium until the purchase moves to the new id. The catalog starts blank too: `books` returns an empty list until books are published from the admin dashboard.
:::

::: danger
**Change the secret behind `MONGODB_URI`, `MONGODB_DB` and `MONGODB_CATALOG_DB` together, in one revision, and only after the code that reads `MONGODB_CATALOG_DB` is live.** Older code would look for `books` in `mintsy_app` and never see what admin publishes. `MONGODB_URI` is bound as `:latest` and Cloud Run resolves a `:latest` secret when an instance starts, so adding a version to that secret would move new instances to the new cluster on their own, with the old database names. Use a new secret, pinned to a version.
:::

### Atlas users

| User    | Roles                                        | Used by                                             |
| ------- | -------------------------------------------- | --------------------------------------------------- |
| Backend | `readWrite@mintsy_app`, `read@mintsy_studio` | Cloud Run `MONGODB_URI`                             |
| Studio  | `readWrite@mintsy_studio`                    | studio worker, admin dashboard, `pnpm seed:catalog` |

### Order

1. Deploy the code with the env unchanged. A deploy only swaps the image, so it logs `Database: mintsy (catalog: mintsy)` and serves as before.
2. Create the new cluster, the users above and network access. Don't change anything on the old cluster.
3.  Create a **new** secret holding the backend user's connection string, not a new version of `MONGODB_URI`, and grant the runtime service account access to it. Nothing uses it yet.

    ```sh
    printf '%s' '<backend user connection string>' | gcloud secrets create MONGODB_URI_SPLIT --project mintsy-prod --data-file=-
    SA=$(gcloud run services describe mintsy-api --region us-central1 --project mintsy-prod \
      --format 'value(spec.template.spec.serviceAccountName)')
    [ -z "$SA" ] && SA="$(gcloud projects describe mintsy-prod --format 'value(projectNumber)')-compute@developer.gserviceaccount.com"
    gcloud secrets add-iam-policy-binding MONGODB_URI_SPLIT --project mintsy-prod \
      --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
    ```
4.  Switch, in one command, so all three change in one revision:

    ```sh
    gcloud run services update mintsy-api --region us-central1 --project mintsy-prod \
      --update-secrets MONGODB_URI=MONGODB_URI_SPLIT:1 \
      --update-env-vars MONGODB_DB=mintsy_app,MONGODB_CATALOG_DB=mintsy_studio
    ```
5. Check the new revision's log for `Database: mintsy_app (catalog: mintsy_studio)` and no `Unauthorized`.
6. Check that `books` returns an empty list, a new account can sign up and sign in, and a RevenueCat test event answers 200.
7. Point studio and admin at `mintsy_studio` with the studio user and start them. The worker creates the catalog indexes. Publish the catalog from admin.

### Rollback

The old cluster is left untouched and is the only rollback, so keep it, and the `MONGODB_URI` secret, exactly as they are. To go back, route traffic to the previous revision, which is still bound to that secret and the old env (see [Rolling back](./#rolling-back)). Nothing copies data between the clusters: anything written to the new cluster, including new accounts, stays behind.

## Rolling back

TODO: confirm the preferred rollback procedure. Cloud Run keeps earlier revisions, so routing traffic back to the previous revision (`gcloud run services update-traffic mintsy-api --to-revisions <revision>=100 --region us-central1 --project mintsy-prod`) is the usual option, but no rollback is documented in the repo.
