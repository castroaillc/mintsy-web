// RevenueCat webhook in REST mode. The key is fake and RevenueCat's API is stubbed, so nothing leaves
// this machine; src/env.ts reads the key at import, which is why this needs its own file (and process).
// Needs a local MongoDB replica set. Run: pnpm test
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

const AUTH = "Bearer test-webhook-auth";
useTestEnv({ REVENUECAT_WEBHOOK_AUTH: AUTH, REVENUECAT_SECRET_API_KEY: "fake-key-for-tests" });

const express = (await import("express")).default;
const { client } = await import("../src/db.js");
const { entitlements, ensureEntitlementIndexes, getPremium, revenueCatEvents } = await import("../src/entitlements.js");
const { revenueCatWebhook } = await import("../src/revenuecat-webhook.js");

const DAY = 24 * 3600 * 1000;
const PRODUCT = "mintsy_premium_yearly";
const SUBSCRIBERS = "https://api.revenuecat.com/v1/subscribers/";

let baseUrl = "";
let close: () => Promise<void> = async () => {};
const eventIds: string[] = [];
const userIds: string[] = [];

/** What the stub answers per user id. Missing = RevenueCat grants nothing, as for an unlisted sandbox account. */
const granted = new Map<string, Date>();
const restCalls: string[] = [];

const realFetch = globalThis.fetch;
function stubFetch(input: string | URL | Request, init?: RequestInit) {
  const url = input instanceof Request ? input.url : String(input);
  if (url.startsWith(baseUrl)) return realFetch(input, init);
  if (!url.startsWith(SUBSCRIBERS)) throw new Error(`Unexpected request in test: ${url}`);
  const userId = decodeURIComponent(url.slice(SUBSCRIBERS.length));
  restCalls.push(userId);
  const expires = granted.get(userId)?.toISOString();
  return Promise.resolve(
    Response.json({
      subscriber: expires
        ? {
            entitlements: { premium: { expires_date: expires, product_identifier: PRODUCT } },
            subscriptions: { [PRODUCT]: { expires_date: expires, period_type: "NORMAL", store: "APP_STORE" } },
          }
        : { entitlements: {}, subscriptions: {} },
    }),
  );
}

function sandboxEvent(type: string, userId: string, at: number, extra: Record<string, unknown> = {}) {
  const id = randomId("evt");
  eventIds.push(id);
  return {
    api_version: "1.0",
    event: { id, type, event_timestamp_ms: at, app_user_id: userId, environment: "SANDBOX", entitlement_ids: ["premium"], store: "APP_STORE", ...extra },
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

describe("RevenueCat webhook: SANDBOX events in REST mode", () => {
  before(async () => {
    await client.connect();
    await ensureEntitlementIndexes();
    const app = express();
    app.use(revenueCatWebhook);
    const server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => new Promise((r) => server.close(() => r()));
    globalThis.fetch = stubFetch as typeof fetch;
  });
  after(async () => {
    globalThis.fetch = realFetch;
    await close();
    await entitlements.deleteMany({ userId: { $in: userIds } });
    await revenueCatEvents.deleteMany({ _id: { $in: eventIds } });
    await client.close();
  });

  test("a purchase refetches the subscriber and stores that, not the event", async () => {
    const userId = randomId("rc-user");
    userIds.push(userId);
    const expires = new Date(Date.now() + 30 * DAY);
    granted.set(userId, expires);

    const purchase = sandboxEvent("INITIAL_PURCHASE", userId, Date.now(), { product_id: "from_the_event", expiration_at_ms: Date.now() + DAY });
    const res = await post(purchase);
    assert.deepEqual(res, { status: 200, body: { status: "ok", applied: 1, stale: 0 } });
    assert.deepEqual(restCalls.filter((id) => id === userId), [userId]);
    assert.ok(await revenueCatEvents.findOne({ _id: purchase.event.id }));

    const premium = await getPremium(userId);
    assert.equal(premium.active, true);
    assert.equal(premium.productId, PRODUCT);
    assert.equal(premium.expiresAt, expires.toISOString());
  });

  test("an EXPIRATION stores the refetched state, so an active subscription stays active", async () => {
    const userId = randomId("rc-user");
    userIds.push(userId);
    granted.set(userId, new Date(Date.now() + 30 * DAY));

    const res = await post(sandboxEvent("EXPIRATION", userId, Date.now(), { expiration_at_ms: Date.now() - 1000 }));
    assert.equal(res.body.status, "ok");
    assert.equal((await getPremium(userId)).active, true);
  });

  test("when RevenueCat grants nothing, the event grants nothing", async () => {
    const userId = randomId("rc-user");
    userIds.push(userId);

    const res = await post(sandboxEvent("INITIAL_PURCHASE", userId, Date.now(), { expiration_at_ms: Date.now() + 30 * DAY }));
    assert.equal(res.body.status, "ok");
    assert.equal((await getPremium(userId)).active, false);
  });
});
