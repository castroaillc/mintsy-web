# Premium and RevenueCat

## The free tier

Episodes `1..FREE_EPISODES` (3, `src/constants.ts`) of every book are free. Later episodes need the RevenueCat entitlement `premium` (`PREMIUM_ENTITLEMENT`). The apps get the same number from `@mintsy/shared`, which the backend doesn't use yet; change both together.

`Episode.locked = number > 3 && !viewer.premium.active`. Signed-out viewers are never Premium. A locked episode returns `videoUrl: null`, `hlsUrl: null`, `transcript: []` and `takeaways: []`; title, summary, duration and thumbnail stay. The viewer's entitlement is read once per request (`ctx.viewerPremium()`).

## Identity

The app identifies RevenueCat customers with the Better Auth user id (`Purchases.logIn(user.id)`), so RevenueCat's `app_user_id` is our user id. The web app sells through **RevenueCat Web Billing** with the same entitlement and the same `app_user_id`.

## How state gets in

```
App Store / Web Billing / Stripe ──▶ RevenueCat ──webhook──▶ POST /webhooks/revenuecat ──▶ entitlements
                                         ▲
app: purchase / restore ──▶ refreshPremium ──REST GET /v1/subscribers/{id}──┘
```

* **Webhook** (`src/revenuecat-webhook.ts`): every subscription event.
* **`refreshPremium`** mutation: the app calls it right after a purchase, restore or entitlement change, then refetches the catalog.

`Premium.active` is computed on read (`toPremium`): false once `expiresAt` and any billing grace period have passed, even if the stored `active` flag is stale. `expiresAt: null` with `active: true` means lifetime.

## Webhook

`POST https://api.getmintsy.com/webhooks/revenuecat`

| Step               | Behaviour                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth               | `Authorization` must equal `REVENUECAT_WEBHOOK_AUTH` (constant-time compare). Unset → `503`; mismatch → `401`.                                                |
| Validation         | Missing `event`, `event.id`, `event.type` or `event_timestamp_ms` → `400`.                                                                                    |
| Ignored with `200` | `TEST` events; unhandled types (payload mode only); events for other entitlements; anonymous `$RCAnonymousID:` users with no real alias; `SANDBOX` events (payload mode only); duplicate event ids. |
| Idempotency        | The event id is inserted into `revenueCatEvents` (unique `_id`, kept 90 days). RevenueCat retries reuse the id, so they're ignored.                           |
| Ordering           | Each entitlement stores `lastEventAtMs`; an event older than the newest one applied to that user is skipped as stale.                                         |
| Errors             | Processing failure → `500` and the event id is released, so RevenueCat's retry is processed.                                                                  |

**Two modes:**

* **REST mode** (`REVENUECAT_SECRET_API_KEY` set, recommended): every event triggers `GET https://api.revenuecat.com/v1/subscribers/{app_user_id}` and that state is stored. Note: this call creates the RevenueCat customer if it doesn't exist (the app's `logIn` does too).
* **Payload mode** (no key): state comes from the event itself, for `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION`, `UNCANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `TRANSFER`. `SANDBOX` events are ignored. `refreshPremium` then just returns what's stored and logs a warning.

`TRANSFER` updates every user in `transferred_from` and `transferred_to`. Web Billing (`store: "RC_BILLING"`) and Stripe (`"STRIPE"`) events go through the same webhook and code path as App Store events (trial, renewal, cancellation, billing issue, expiration); see `test/revenuecat-webhook.test.ts`.

`store` is stored lowercased (`app_store`, `rc_billing`, `stripe`, `play_store`, `promotional`, ...); clients use it to send users to the right place to manage their subscription.

## Sandbox purchases

Who gets an entitlement from a sandbox purchase is decided in RevenueCat, not in this backend. The production project's Sandbox Testing Access (Project settings → General, "Allow testing entitlements and in-app currency for") is set to **Allowed App User IDs only**. See [RevenueCat's docs](https://www.revenuecat.com/docs/projects/sandbox-access).

* **It's a project-level setting.** It covers every app in the project, and both platform sandboxes and Test Store. The backend keeps no list of its own.
* **List entries are App User IDs,** which for mintsy are Better Auth user ids (see [Identity](#identity)). A recreated account has a new id, so it has to be added again.
* **Anyone else's sandbox purchase** is still recorded in RevenueCat but grants no entitlement. Removing an account from the list also removes the entitlements its sandbox purchases already granted.

What the webhook does with `event.environment === "SANDBOX"` depends on the mode:

* **REST mode:** nothing special. The event triggers the normal refetch, and `GET /v1/subscribers/{id}` returns what RevenueCat has granted, including sandbox entitlements for a listed account, so no `X-Is-Sandbox` header is needed.
* **Payload mode:** the event is ignored with `200`, before its id is claimed. The event itself would be stored here, so a sandbox `EXPIRATION` could end a real subscription. A sandbox purchase therefore never unlocks Premium on a server without `REVENUECAT_SECRET_API_KEY`, even for a listed account; set the key to test real sandbox purchases.

### App Review

The demo account given to App Review must be on the list. A reviewer's purchase is a sandbox purchase, and it only unlocks Premium for an account on the list. For any other account the purchase goes through but the locked episodes stay locked. Check the list before submitting, and again whenever the demo account is recreated.

Keep demo account credentials and listed ids out of these docs and the repo.

## Production setup

1. In RevenueCat (Project → Integrations → Webhooks): set the URL above and an **Authorization header value**: a random string, e.g. `Bearer $(openssl rand -hex 32)`.
2. Store the exact same string as the secret `REVENUECAT_WEBHOOK_AUTH`, and a v1 secret API key (`sk_...`) as `REVENUECAT_SECRET_API_KEY`, in Secret Manager (project `mintsy-prod`).
3. Grant the Cloud Run service account `roles/secretmanager.secretAccessor` on both and expose them to `mintsy-api` (`gcloud run services update ... --update-secrets`).
4. Use RevenueCat's "Send test event": expect 200, logged as ignored.
5. Set Sandbox Testing Access to **Allowed App User IDs only** and list the test accounts and the App Review demo account (see [Sandbox purchases](#sandbox-purchases)).

```sh
printf '%s' 'Bearer <random>' | gcloud secrets create REVENUECAT_WEBHOOK_AUTH --project mintsy-prod --data-file=-
printf '%s' 'sk_...'          | gcloud secrets create REVENUECAT_SECRET_API_KEY --project mintsy-prod --data-file=-
SA=$(gcloud run services describe mintsy-api --region us-central1 --project mintsy-prod \
  --format 'value(spec.template.spec.serviceAccountName)')   # empty = default compute SA
for s in REVENUECAT_WEBHOOK_AUTH REVENUECAT_SECRET_API_KEY; do
  gcloud secrets add-iam-policy-binding $s --project mintsy-prod \
    --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
done
gcloud run services update mintsy-api --region us-central1 --project mintsy-prod \
  --update-secrets REVENUECAT_WEBHOOK_AUTH=REVENUECAT_WEBHOOK_AUTH:latest,REVENUECAT_SECRET_API_KEY=REVENUECAT_SECRET_API_KEY:latest
```

## Local test

Set `REVENUECAT_WEBHOOK_AUTH=Bearer test` in `.env`, restart, and post an event. It has no `environment` field, so the sandbox guard doesn't apply:

```sh
curl -X POST localhost:4000/webhooks/revenuecat -H 'Content-Type: application/json' -H 'Authorization: Bearer test' \
  -d '{"api_version":"1.0","event":{"id":"evt-1","type":"INITIAL_PURCHASE","event_timestamp_ms":'$(date +%s000)',
       "app_user_id":"<user id from { me { id } }>","product_id":"yearly","period_type":"TRIAL",
       "expiration_at_ms":'$(( $(date +%s) + 604800 ))000',"entitlement_ids":["premium"],"store":"APP_STORE"}}'
```

## Storage

* `entitlements`: one doc per user, unique on `userId`. See [MongoDB collections](../architecture/mongodb-collections.md#entitlements).
* `revenueCatEvents`: processed event ids, TTL 90 days.

Account deletion removes the user's entitlement and, in REST mode, deletes the RevenueCat subscriber. It doesn't cancel store subscriptions.
