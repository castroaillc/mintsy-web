# Premium and RevenueCat

## The free tier

Episodes `1..FREE_EPISODES` (3, `src/constants.ts`) of every book are free. Later episodes need the RevenueCat entitlement `premium` (`PREMIUM_ENTITLEMENT`). The mobile app has the same constant; change both together.

`Episode.locked = number > 3 && !viewer.premium.active`. Signed-out viewers are never Premium. A locked episode returns `videoUrl: null`, `transcript: []` and `takeaways: []`; title, summary, duration and thumbnail stay. The viewer's entitlement is read once per request (`ctx.viewerPremium()`).

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

| Step | Behaviour |
| --- | --- |
| Auth | `Authorization` must equal `REVENUECAT_WEBHOOK_AUTH` (constant-time compare). Unset → `503`; mismatch → `401`. |
| Validation | Missing `event`, `event.id`, `event.type` or `event_timestamp_ms` → `400`. |
| Ignored with `200` | `TEST` events; unhandled types (payload mode only); events for other entitlements; anonymous `$RCAnonymousID:` users with no real alias; duplicate event ids. |
| Idempotency | The event id is inserted into `revenueCatEvents` (unique `_id`, kept 90 days). RevenueCat retries reuse the id, so they're ignored. |
| Ordering | Each entitlement stores `lastEventAtMs`; an event older than the newest one applied to that user is skipped as stale. |
| Errors | Processing failure → `500` and the event id is released, so RevenueCat's retry is processed. |

**Two modes:**

* **REST mode** (`REVENUECAT_SECRET_API_KEY` set, recommended): every event triggers `GET https://api.revenuecat.com/v1/subscribers/{app_user_id}` and that state is stored. Note: this call creates the RevenueCat customer if it doesn't exist.
* **Payload mode** (no key): state comes from the event itself, for `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION`, `UNCANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `TRANSFER`. `refreshPremium` then just returns what's stored and logs a warning.

`TRANSFER` updates every user in `transferred_from` and `transferred_to`. Web Billing (`store: "RC_BILLING"`) and Stripe (`"STRIPE"`) events go through the same code path as App Store events; see `test/revenuecat-webhook.test.ts`.

`store` is stored lowercased (`app_store`, `rc_billing`, `stripe`, `play_store`, `promotional`, ...); clients use it to send users to the right place to manage their subscription.

## Production setup

1. In RevenueCat (Project → Integrations → Webhooks): set the URL above and an **Authorization header value**, e.g. `Bearer <random hex>`.
2. Store the exact same string as the secret `REVENUECAT_WEBHOOK_AUTH`, and a v1 secret API key (`sk_...`) as `REVENUECAT_SECRET_API_KEY`, in Secret Manager (project `mintsy-prod`).
3. Grant the Cloud Run service account `roles/secretmanager.secretAccessor` on both and expose them to `mintsy-api` (`gcloud run services update ... --update-secrets`).
4. Use RevenueCat's "Send test event": expect 200, logged as ignored.

The exact commands are in the backend `README.md` ("Premium").

## Local test

Set `REVENUECAT_WEBHOOK_AUTH=Bearer test` in `.env`, restart, and post an event:

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
