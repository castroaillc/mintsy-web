import { MongoServerError } from "mongodb";
import { PREMIUM_ENTITLEMENT } from "./constants.js";
import { db } from "./db.js";
import { env } from "./env.js";

/**
 * One document per Better Auth user id: the user's `premium` entitlement as last reported by
 * RevenueCat (REST API or webhook). Missing doc = never subscribed.
 */
export interface EntitlementDoc {
  userId: string;
  active: boolean;
  productId: string | null;
  /** RevenueCat period type, lowercased: "trial" | "normal" | "intro" (others passed through). */
  periodType: string | null;
  /** End of the current period; null = never expires (lifetime) or unknown. */
  expiresAt: Date | null;
  /** Billing-issue grace period end, if any; access continues until then. */
  graceExpiresAt?: Date | null;
  willRenew: boolean;
  /** "app_store" | "play_store" | ... (lowercased). */
  store: string | null;
  updatedAt: Date;
  /** event_timestamp_ms of the newest webhook applied; older events are ignored. */
  lastEventAtMs?: number;
}

/** The GraphQL `Premium` shape. */
export interface Premium {
  active: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  periodType: string | null;
  productId: string | null;
}

export const entitlements = db.collection<EntitlementDoc>("entitlements");

/** Processed RevenueCat webhook event ids, for idempotency (RevenueCat retries reuse the id). */
export const revenueCatEvents = db.collection<{ _id: string; type: string; receivedAt: Date }>(
  "revenueCatEvents",
);

export async function ensureEntitlementIndexes() {
  await entitlements.createIndex({ userId: 1 }, { unique: true });
  // _id is the event id; keep 90 days of ids (RevenueCat stops retrying after a few hours)
  await revenueCatEvents.createIndex({ receivedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
}

export const NOT_PREMIUM: Premium = {
  active: false,
  expiresAt: null,
  willRenew: false,
  periodType: null,
  productId: null,
};

/** Doc → GraphQL. `active` also respects the dates, so a stale stored flag can't outlive expiry. */
export function toPremium(doc: EntitlementDoc | null, now = Date.now()): Premium {
  if (!doc) return NOT_PREMIUM;
  const accessUntil = Math.max(doc.expiresAt?.getTime() ?? 0, doc.graceExpiresAt?.getTime() ?? 0);
  const active = doc.active && (doc.expiresAt === null || accessUntil > now);
  return {
    active,
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    willRenew: doc.willRenew,
    periodType: doc.periodType,
    productId: doc.productId,
  };
}

export async function getPremium(userId: string): Promise<Premium> {
  return toPremium(await entitlements.findOne({ userId }));
}

export function isAnonymousAppUserId(id: string) {
  return id.startsWith("$RCAnonymousID:");
}

type EntitlementState = Omit<EntitlementDoc, "userId" | "updatedAt" | "lastEventAtMs">;

/**
 * Stores state for a user. With `eventAtMs`, the write only applies if no newer event has been
 * stored (order-safe); returns false when it was skipped as stale.
 */
export async function storeEntitlement(
  userId: string,
  state: EntitlementState,
  eventAtMs?: number,
): Promise<boolean> {
  const updatedAt = new Date();
  if (eventAtMs === undefined) {
    // A REST refetch is current state, so it always applies (and keeps lastEventAtMs as is)
    await entitlements.updateOne({ userId }, { $set: { ...state, updatedAt } }, { upsert: true });
    return true;
  }
  try {
    await entitlements.updateOne(
      {
        userId,
        $or: [{ lastEventAtMs: { $exists: false } }, { lastEventAtMs: { $lte: eventAtMs } }],
      },
      { $set: { ...state, updatedAt, lastEventAtMs: eventAtMs } },
      { upsert: true },
    );
    return true;
  } catch (err) {
    // The filter missed an existing doc with a newer event, so the upsert collided on userId
    if (err instanceof MongoServerError && err.code === 11000) return false;
    throw err;
  }
}

/** Marks a newer event as seen without changing state (used when a REST refetch applied it). */
export async function bumpLastEvent(userId: string, eventAtMs: number) {
  await entitlements.updateOne(
    { userId, $or: [{ lastEventAtMs: { $exists: false } }, { lastEventAtMs: { $lt: eventAtMs } }] },
    { $set: { lastEventAtMs: eventAtMs } },
  );
}

/** Newest event already applied for a user, or 0. */
export async function lastEventAt(userId: string) {
  const doc = await entitlements.findOne({ userId }, { projection: { lastEventAtMs: 1 } });
  return doc?.lastEventAtMs ?? 0;
}

// ---- RevenueCat REST API (v1) ----

interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
  purchase_date?: string;
}

interface RcSubscription {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  period_type?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  store?: string;
}

interface RcSubscriberResponse {
  subscriber: {
    entitlements?: Record<string, RcEntitlement>;
    subscriptions?: Record<string, RcSubscription>;
  };
}

export const revenueCatRestConfigured = () => Boolean(env.revenueCatSecretApiKey);

const toDate = (s: string | null | undefined) => (s ? new Date(s) : null);

/** Maps GET /v1/subscribers/{id} to our state for the `premium` entitlement. */
export function stateFromSubscriber(body: RcSubscriberResponse, now = Date.now()): EntitlementState {
  const ent = body.subscriber.entitlements?.[PREMIUM_ENTITLEMENT];
  if (!ent) {
    return { active: false, productId: null, periodType: null, expiresAt: null, graceExpiresAt: null, willRenew: false, store: null };
  }
  const sub = body.subscriber.subscriptions?.[ent.product_identifier];
  const expiresAt = toDate(ent.expires_date);
  const graceExpiresAt = toDate(ent.grace_period_expires_date ?? sub?.grace_period_expires_date);
  const accessUntil = Math.max(expiresAt?.getTime() ?? 0, graceExpiresAt?.getTime() ?? 0);
  const active = expiresAt === null || accessUntil > now;
  return {
    active,
    productId: ent.product_identifier,
    periodType: sub?.period_type?.toLowerCase() ?? null,
    expiresAt,
    graceExpiresAt,
    // Lifetime purchases (no expiry) don't renew; neither do cancelled or billing-failed subscriptions
    willRenew:
      active && expiresAt !== null && !!sub && !sub.unsubscribe_detected_at && !sub.billing_issues_detected_at,
    store: sub?.store?.toLowerCase() ?? null,
  };
}

/** GET https://api.revenuecat.com/v1/subscribers/{app_user_id}. Note: RevenueCat creates the customer if missing. */
export async function fetchSubscriberState(userId: string): Promise<EntitlementState> {
  const key = env.revenueCatSecretApiKey;
  if (!key) throw new Error("REVENUECAT_SECRET_API_KEY is not set");
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`RevenueCat GET /subscribers returned ${res.status}`);
  return stateFromSubscriber((await res.json()) as RcSubscriberResponse);
}

/** Refetches from RevenueCat and stores it. Without a secret key, returns what's stored (with a warning). */
export async function refreshPremium(userId: string): Promise<Premium> {
  if (!revenueCatRestConfigured()) {
    console.warn("refreshPremium: REVENUECAT_SECRET_API_KEY is not set; returning the stored entitlement");
    return getPremium(userId);
  }
  await storeEntitlement(userId, await fetchSubscriberState(userId));
  return getPremium(userId);
}
