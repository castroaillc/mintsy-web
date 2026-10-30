// RevenueCat webhook with Web Billing (store RC_BILLING) and Stripe events, payload-only mode
// (no REVENUECAT_SECRET_API_KEY). Needs a local MongoDB replica set. Run: pnpm test
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

const AUTH = "Bearer test-webhook-auth";
useTestEnv({ REVENUECAT_WEBHOOK_AUTH: AUTH });

const express = (await import("express")).default;
const { client } = await import("../src/db.js");
const { entitlements, ensureEntitlementIndexes, getPremium, revenueCatEvents, stateFromSubscriber } = await import(
  "../src/entitlements.js"
);
const { revenueCatWebhook } = await import("../src/revenuecat-webhook.js");

let baseUrl = "";
let close: () => Promise<void> = async () => {};
const eventIds: string[] = [];
const userIds: string[] = [];

const DAY = 24 * 3600 * 1000;

/**
 * A Web Billing event as RevenueCat sends it (fields per RevenueCat's webhook docs; Web Billing uses
 * store "RC_BILLING", the Stripe integration "STRIPE").
 */
function rcBillingEvent(type: string, userId: string, at: number, extra: Record<string, unknown> = {}) {
  const id = randomId("evt");
  eventIds.push(id);
  return {
    api_version: "1.0",
    event: {
      id,
      type,
      event_timestamp_ms: at,
      app_id: "app1234567890",
      app_user_id: userId,
      original_app_user_id: userId,
      aliases: [userId],
      product_id: "mintsy_premium_yearly",
      period_type: "NORMAL",
      purchased_at_ms: at,
      expiration_at_ms: at + 365 * DAY,
      environment: "SANDBOX",
      entitlement_id: null,
      entitlement_ids: ["premium"],
      presented_offering_id: "default",
      transaction_id: `txn_${id}`,
      original_transaction_id: `txn_${userId}`,
      is_family_share: false,
      country_code: "US",
      currency: "USD",
      price: 59.99,
      price_in_purchased_currency: 59.99,
      store: "RC_BILLING",
      takehome_percentage: 0.95,
      offer_code: null,
      tax_percentage: 0,
      commission_percentage: 0.05,
      renewal_number: 1,
      subscriber_attributes: { $email: { value: "someone@example.com", updated_at_ms: at } },
      ...extra,
    },
  };
}

async function post(body: unknown) {
  const res = await fetch(`${baseUrl}/webhooks/revenuecat`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("RevenueCat webhook: Web Billing (RC_BILLING)", () => {
  before(async () => {
    await client.connect();
    await ensureEntitlementIndexes();
    const app = express();
    app.use(revenueCatWebhook);
    const server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => new Promise((r) => server.close(() => r()));
  });
  after(async () => {
    await close();
    await entitlements.deleteMany({ userId: { $in: userIds } });
    await revenueCatEvents.deleteMany({ _id: { $in: eventIds } });
    await client.close();
  });

  test("trial → renewal → cancellation → expiration", async () => {
    const userId = randomId("rc-user");
    userIds.push(userId);
    const t0 = Date.now() - 10 * DAY;

    // Trial start (7 days)
    let res = await post(rcBillingEvent("INITIAL_PURCHASE", userId, t0, { period_type: "TRIAL", expiration_at_ms: Date.now() + 7 * DAY, price: 0 }));
    assert.deepEqual(res, { status: 200, body: { status: "ok", applied: 1, stale: 0 } });
    let premium = await getPremium(userId);
    assert.equal(premium.active, true);
    assert.equal(premium.periodType, "trial");
    assert.equal(premium.willRenew, true);
    assert.equal(premium.store, "rc_billing");
    assert.equal(premium.productId, "mintsy_premium_yearly");

    // First paid period
    const renewalExpires = Date.now() + 365 * DAY;
    res = await post(rcBillingEvent("RENEWAL", userId, t0 + 7 * DAY, { expiration_at_ms: renewalExpires }));
    assert.equal(res.status, 200);
    premium = await getPremium(userId);
    assert.deepEqual(
      { ...premium },
      { active: true, expiresAt: new Date(renewalExpires).toISOString(), willRenew: true, periodType: "normal", productId: "mintsy_premium_yearly", store: "rc_billing" },
    );

    // Cancelled on the web: access continues until the period ends, but it won't renew
    res = await post(rcBillingEvent("CANCELLATION", userId, t0 + 8 * DAY, { expiration_at_ms: renewalExpires, cancel_reason: "UNSUBSCRIBE" }));
    assert.equal(res.status, 200);
    premium = await getPremium(userId);
    assert.equal(premium.active, true);
    assert.equal(premium.willRenew, false);
    assert.equal(premium.store, "rc_billing");

    // A late, out-of-order delivery of the renewal doesn't undo the cancellation
    const late = rcBillingEvent("RENEWAL", userId, t0 + 7 * DAY + 1, { expiration_at_ms: renewalExpires });
    res = await post(late);
    assert.equal(res.body.stale, 1);
    assert.equal((await getPremium(userId)).willRenew, false);

    // Duplicate delivery is ignored
    res = await post(late);
    assert.deepEqual(res.body, { status: "ignored", reason: "duplicate event id" });

    // Expiration
    res = await post(rcBillingEvent("EXPIRATION", userId, t0 + 9 * DAY, { expiration_at_ms: Date.now() - 1000, expiration_reason: "UNSUBSCRIBE" }));
    assert.equal(res.status, 200);
    premium = await getPremium(userId);
    assert.equal(premium.active, false);
    assert.equal(premium.willRenew, false);
    assert.equal(premium.store, "rc_billing");
  });

  test("Stripe store events are handled the same way", async () => {
    const userId = randomId("rc-user");
    userIds.push(userId);
    const res = await post(rcBillingEvent("INITIAL_PURCHASE", userId, Date.now(), { store: "STRIPE", product_id: "mintsy_premium_monthly", expiration_at_ms: Date.now() + 30 * DAY }));
    assert.equal(res.status, 200);
    const premium = await getPremium(userId);
    assert.equal(premium.active, true);
    assert.equal(premium.store, "stripe");
    assert.equal(premium.productId, "mintsy_premium_monthly");
  });

  test("billing issue keeps access through the grace period", async () => {
    const userId = randomId("rc-user");
    userIds.push(userId);
    const now = Date.now();
    await post(rcBillingEvent("INITIAL_PURCHASE", userId, now - 2000, { expiration_at_ms: now + DAY }));
    await post(rcBillingEvent("BILLING_ISSUE", userId, now - 1000, { expiration_at_ms: now - 500, grace_period_expiration_at_ms: now + 3 * DAY }));
    const premium = await getPremium(userId);
    assert.equal(premium.active, true);
    assert.equal(premium.willRenew, false);
  });

  test("REST mode: a Web Billing subscriber maps to store rc_billing", () => {
    const expires = new Date(Date.now() + 30 * DAY).toISOString();
    const state = stateFromSubscriber({
      subscriber: {
        entitlements: { premium: { expires_date: expires, product_identifier: "mintsy_premium_monthly", purchase_date: new Date().toISOString() } },
        subscriptions: {
          mintsy_premium_monthly: { expires_date: expires, period_type: "trial", store: "rc_billing", unsubscribe_detected_at: null, billing_issues_detected_at: null },
        },
      },
    });
    assert.equal(state.active, true);
    assert.equal(state.store, "rc_billing");
    assert.equal(state.periodType, "trial");
    assert.equal(state.willRenew, true);
  });
});
