import { createHash, timingSafeEqual } from "node:crypto";
import express, { type Request, type Response } from "express";
import { PREMIUM_ENTITLEMENT } from "./constants.js";
import {
  entitlements,
  fetchSubscriberState,
  isAnonymousAppUserId,
  revenueCatEvents,
  revenueCatRestConfigured,
  storeEntitlement,
  type EntitlementDoc,
} from "./entitlements.js";
import { env } from "./env.js";

/**
 * RevenueCat webhook (https://www.revenuecat.com/docs/integrations/webhooks).
 * Body: { api_version, event: { id, type, event_timestamp_ms, app_user_id, ... } }.
 *
 * - Auth: the Authorization header must equal REVENUECAT_WEBHOOK_AUTH (503 while unset).
 * - Idempotent by event.id (retries reuse it); order-safe by event_timestamp_ms.
 * - With REVENUECAT_SECRET_API_KEY, every event triggers a refetch of the subscriber from the REST
 *   API and that is stored (RevenueCat's recommendation). Without it, state comes from the payload.
 */
interface RcEvent {
  id: string;
  type: string;
  event_timestamp_ms: number;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  product_id?: string;
  new_product_id?: string;
  period_type?: string;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  store?: string;
  environment?: string;
}

const PAYLOAD_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "CANCELLATION",
  "UNCANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "TRANSFER",
]);

function authorized(header: string | undefined, expected: string) {
  // Hash both sides so timingSafeEqual gets equal-length inputs
  const a = createHash("sha256").update(header ?? "").digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) && header !== undefined;
}

const realIds = (ids: (string | undefined | null)[]) => [
  ...new Set(ids.filter((id): id is string => !!id && !isAnonymousAppUserId(id))),
];

/** The Better Auth user id(s) an event is about. */
function userIdsFor(event: RcEvent) {
  if (event.type === "TRANSFER") {
    return realIds([...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]);
  }
  const primary = realIds([event.app_user_id]);
  if (primary.length) return primary;
  // app_user_id is anonymous: fall back to a non-anonymous alias, if RevenueCat has one
  return realIds([event.original_app_user_id, ...(event.aliases ?? [])]).slice(0, 1);
}

function concernsPremium(event: RcEvent) {
  if (Array.isArray(event.entitlement_ids)) return event.entitlement_ids.includes(PREMIUM_ENTITLEMENT);
  if (event.entitlement_id) return event.entitlement_id === PREMIUM_ENTITLEMENT;
  return true; // not stated (e.g. TRANSFER): assume it may
}

type State = Omit<EntitlementDoc, "userId" | "updatedAt" | "lastEventAtMs">;

/** Payload-only state, used when no REST key is configured. */
function stateFromEvent(event: RcEvent, now = Date.now()): State {
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const graceExpiresAt = event.grace_period_expiration_at_ms
    ? new Date(event.grace_period_expiration_at_ms)
    : null;
  const accessUntil = Math.max(expiresAt?.getTime() ?? 0, graceExpiresAt?.getTime() ?? 0);
  const active = event.type !== "EXPIRATION" && (expiresAt === null || accessUntil > now);
  const renewing = ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"].includes(event.type);
  return {
    active,
    // PRODUCT_CHANGE keeps the current product: a deferred change shows up on the next RENEWAL
    productId: event.product_id ?? null,
    periodType: event.period_type?.toLowerCase() ?? null,
    expiresAt,
    graceExpiresAt,
    willRenew: active && renewing && expiresAt !== null,
    store: event.store?.toLowerCase() ?? null,
  };
}

async function applyEvent(event: RcEvent): Promise<{ applied: string[]; stale: string[] }> {
  const ids = userIdsFor(event);
  const applied: string[] = [];
  const stale: string[] = [];
  const ts = event.event_timestamp_ms;

  if (revenueCatRestConfigured()) {
    for (const userId of ids) {
      const state = await fetchSubscriberState(userId);
      ((await storeEntitlement(userId, state, ts)) ? applied : stale).push(userId);
    }
    return { applied, stale };
  }

  if (event.type === "TRANSFER") {
    // The purchase moves from transferred_from to transferred_to. Without the REST API the payload
    // has no state, so move what we had stored for the old user(s).
    const from = realIds(event.transferred_from ?? []);
    const to = realIds(event.transferred_to ?? []);
    const source = from.length
      ? await entitlements.findOne({ userId: { $in: from }, active: true })
      : null;
    for (const userId of from) {
      const off: State = { active: false, productId: null, periodType: null, expiresAt: null, graceExpiresAt: null, willRenew: false, store: null };
      ((await storeEntitlement(userId, off, ts)) ? applied : stale).push(userId);
    }
    if (source) {
      const { active, productId, periodType, expiresAt, graceExpiresAt, willRenew, store } = source;
      const moved: State = { active, productId, periodType, expiresAt, graceExpiresAt: graceExpiresAt ?? null, willRenew, store };
      for (const userId of to) {
        ((await storeEntitlement(userId, moved, ts)) ? applied : stale).push(userId);
      }
    } else if (to.length) {
      console.warn(`RevenueCat TRANSFER ${event.id}: no stored entitlement to move; set REVENUECAT_SECRET_API_KEY to refetch`);
    }
    return { applied, stale };
  }

  const state = stateFromEvent(event);
  for (const userId of ids) {
    ((await storeEntitlement(userId, state, ts)) ? applied : stale).push(userId);
  }
  return { applied, stale };
}

async function handle(req: Request, res: Response) {
  const expected = env.revenueCatWebhookAuth;
  if (!expected) {
    res.status(503).json({ error: "RevenueCat webhook is not configured" });
    return;
  }
  if (!authorized(req.get("authorization"), expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const event = (req.body as { event?: RcEvent } | undefined)?.event;
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
    res.status(400).json({ error: "Missing event" });
    return;
  }
  const ts = Number(event.event_timestamp_ms);
  if (!Number.isFinite(ts)) {
    res.status(400).json({ error: "Missing event_timestamp_ms" });
    return;
  }
  event.event_timestamp_ms = ts;

  const ignore = (reason: string) => {
    console.log(`RevenueCat ${event.type} ${event.id}: ignored (${reason})`);
    res.status(200).json({ status: "ignored", reason });
  };

  if (event.type === "TEST") return ignore("test event");
  if (!revenueCatRestConfigured() && !PAYLOAD_TYPES.has(event.type)) return ignore("unhandled type");
  if (!concernsPremium(event)) return ignore("not the premium entitlement");
  if (userIdsFor(event).length === 0) return ignore("anonymous app user id");

  // Claim the event id; a duplicate delivery hits the unique _id
  try {
    await revenueCatEvents.insertOne({ _id: event.id, type: event.type, receivedAt: new Date() });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return ignore("duplicate event id");
    throw err;
  }

  try {
    const { applied, stale } = await applyEvent(event);
    console.log(
      `RevenueCat ${event.type} ${event.id}: applied to ${applied.length} user(s)` +
        (stale.length ? `, ${stale.length} stale (older than stored)` : ""),
    );
    res.status(200).json({ status: applied.length ? "ok" : "ignored", applied: applied.length, stale: stale.length });
  } catch (err) {
    // Release the id so RevenueCat's retry is processed
    await revenueCatEvents.deleteOne({ _id: event.id }).catch(() => {});
    console.error(`RevenueCat ${event.type} ${event.id}: failed`, err);
    res.status(500).json({ error: "Processing failed" });
  }
}

/** Mount with app.use() before express.json() and the GraphQL middleware; it has its own JSON parser. */
export const revenueCatWebhook = express.Router();
revenueCatWebhook.post("/webhooks/revenuecat", express.json({ limit: "1mb" }), handle);
