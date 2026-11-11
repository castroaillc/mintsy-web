import { createPrivateKey, randomUUID, sign } from "node:crypto";
import express, { type Request, type Response } from "express";
import { MongoServerError } from "mongodb";
import { AppStoreJwsError, decodeAppStoreJwsUnverified, verifyAppStoreJws } from "./app-store-jws.js";
import { db, ensureIndexes } from "./db.js";
import {
  entitlements,
  fetchSubscriberState,
  getPremium,
  refreshPremium as refreshRevenueCatPremium,
  revenueCatRestConfigured,
  storeEntitlement,
  toPremium,
  type AppStoreBinding,
  type EntitlementDoc,
  type Premium,
} from "./entitlements.js";
import { env, type AppStoreEnvironment } from "./env.js";

/**
 * App Store (StoreKit 2) purchases, verified by this API itself (no RevenueCat in between).
 *
 * - `me.appAccountToken`: a UUID per account that the app passes to Product.purchase, so Apple signs it into
 *   every transaction of that purchase and its renewals.
 * - `syncAppStoreTransaction`: the app hands over a signed transaction; it's verified and stored.
 * - `POST /webhooks/app-store`: App Store Server Notifications V2 keep the stored state current.
 * - `refreshPremium`: refetches the subscription from the App Store Server API when credentials are set.
 *
 * All three writers go through applyToUser, which decides from the signed data alone (dates, revocation,
 * renewal info), not from who sent it or from the notification type, so they can arrive in any order.
 */

// ---- The account token ----

interface AppStoreAccountDoc {
  userId: string;
  /** Lowercase UUID v4. */
  appAccountToken: string;
  createdAt: Date;
}

/**
 * One random UUID per user, made on first use and never changed. Random and stored (not derived from the
 * user id) so it says nothing about the id, survives a BETTER_AUTH_SECRET rotation, and can be looked up
 * in reverse: a notification only carries the token.
 */
export const appStoreAccounts = db.collection<AppStoreAccountDoc>("appStoreAccounts");

/** Processed notification UUIDs, for idempotency (Apple's retries reuse the UUID). */
export const appStoreNotifications = db.collection<{ _id: string; type: string; receivedAt: Date }>(
  "appStoreNotifications",
);

export async function ensureAppStoreIndexes() {
  await Promise.all([
    ensureIndexes(appStoreAccounts, [
      { key: { userId: 1 }, unique: true },
      { key: { appAccountToken: 1 }, unique: true },
    ]),
    // Apple retries a failed notification for up to three days; keep 90, as for RevenueCat events
    ensureIndexes(appStoreNotifications, [{ key: { receivedAt: 1 }, expireAfterSeconds: 90 * 24 * 3600 }]),
  ]);
}

const isDuplicateKey = (err: unknown) => err instanceof MongoServerError && err.code === 11000;

/** The user's token (lowercase), created on first use. */
export async function appAccountTokenFor(userId: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await appStoreAccounts.findOneAndUpdate(
        { userId },
        { $setOnInsert: { appAccountToken: randomUUID(), createdAt: new Date() } },
        { upsert: true, returnDocument: "after" },
      );
      if (doc) return doc.appAccountToken;
    } catch (err) {
      // Two first reads raced on the unique userId; the next read finds the winner's token
      if (!isDuplicateKey(err) || attempt >= 2) throw err;
    }
    if (attempt >= 2) throw new Error("Couldn't create the App Store account token");
  }
}

async function userIdForToken(token: string): Promise<string | null> {
  return (await appStoreAccounts.findOne({ appAccountToken: token.toLowerCase() }))?.userId ?? null;
}

export async function deleteAppStoreAccountForUser(userId: string) {
  return (await appStoreAccounts.deleteMany({ userId })).deletedCount;
}

// ---- Signed data ----

export type AppStoreErrorCode =
  | "APP_STORE_INVALID_TRANSACTION"
  | "APP_STORE_WRONG_ENVIRONMENT"
  | "APP_STORE_WRONG_BUNDLE"
  | "APP_STORE_WRONG_PRODUCT"
  | "APP_STORE_WRONG_ACCOUNT"
  | "APP_STORE_SUBSCRIPTION_IN_USE";

/** A transaction this API won't take. `code` becomes the GraphQL error's extensions.code. */
export class AppStoreError extends Error {
  constructor(
    readonly code: AppStoreErrorCode,
    message: string,
    /** For APP_STORE_INVALID_TRANSACTION: malformed | chain | signature | payload. */
    readonly reason?: string,
  ) {
    super(message);
    this.name = "AppStoreError";
  }
}

interface Transaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  environment: string;
  purchaseAtMs: number;
  /** End of the period; the revocation date instead when that's earlier. */
  expiresAtMs: number;
  signedAtMs: number;
  /** Lowercase, or null when the purchase wasn't made with one. */
  appAccountToken: string | null;
  /** Refunded, revoked (left Family Sharing) or replaced by an upgrade: no access whatever the dates. */
  voided: boolean;
  periodType: "trial" | "intro" | "normal";
}

interface RenewalInfo {
  originalTransactionId: string;
  signedAtMs: number;
  /** Auto-renew is on and Apple isn't retrying a failed payment. */
  autoRenew: boolean;
  graceExpiresAtMs: number | null;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const isLocalEnvironment = (name: unknown) => name === "Xcode" || name === "LocalTesting";
const environmentAccepted = (name: string) => env.appStoreEnvironments.includes(name as AppStoreEnvironment);

function wrongEnvironment(name: unknown) {
  return new AppStoreError(
    "APP_STORE_WRONG_ENVIRONMENT",
    `This server doesn't accept ${typeof name === "string" && name ? name : "unknown"} App Store transactions`,
  );
}

/**
 * The payload of a signed transaction or renewal info. Verified against the pinned Apple root, except for
 * Xcode / LocalTesting ones, which a local test certificate signs: those are read unverified, and only
 * where APP_STORE_ENVIRONMENTS lists them (never in production, see src/env.ts).
 */
function readSigned(jws: string): Record<string, unknown> {
  try {
    const claimed = decodeAppStoreJwsUnverified(jws).environment;
    if (isLocalEnvironment(claimed)) {
      if (!env.isProduction && environmentAccepted(claimed as string)) return decodeAppStoreJwsUnverified(jws);
      throw wrongEnvironment(claimed);
    }
    return verifyAppStoreJws(jws);
  } catch (err) {
    if (err instanceof AppStoreJwsError) {
      throw new AppStoreError("APP_STORE_INVALID_TRANSACTION", err.message, err.reason);
    }
    throw err;
  }
}

const invalidPayload = (what: string) =>
  new AppStoreError("APP_STORE_INVALID_TRANSACTION", `The transaction has no ${what}`, "payload");

function parseTransaction(payload: Record<string, unknown>): Transaction {
  const transactionId = str(payload.transactionId);
  const originalTransactionId = str(payload.originalTransactionId);
  const purchaseAtMs = num(payload.purchaseDate);
  const expiresDate = num(payload.expiresDate);
  const revocationDate = num(payload.revocationDate);
  if (!transactionId) throw invalidPayload("transactionId");
  if (!originalTransactionId) throw invalidPayload("originalTransactionId");
  if (purchaseAtMs === null) throw invalidPayload("purchaseDate");
  // Only auto-renewable subscriptions are sold; anything else has no expiresDate
  if (expiresDate === null) throw invalidPayload("expiresDate (it isn't a subscription)");
  return {
    transactionId,
    originalTransactionId,
    bundleId: str(payload.bundleId) ?? "",
    productId: str(payload.productId) ?? "",
    environment: str(payload.environment) ?? "",
    purchaseAtMs,
    expiresAtMs: revocationDate === null ? expiresDate : Math.min(expiresDate, revocationDate),
    // An Xcode transaction may lack signedDate; its purchase date still orders it
    signedAtMs: num(payload.signedDate) ?? purchaseAtMs,
    appAccountToken: str(payload.appAccountToken)?.toLowerCase() ?? null,
    voided: revocationDate !== null || payload.isUpgraded === true,
    // offerType 1 is the introductory offer; its free form is the trial. Other offers count as normal
    periodType: payload.offerDiscountType === "FREE_TRIAL" ? "trial" : payload.offerType === 1 ? "intro" : "normal",
  };
}

function parseRenewalInfo(payload: Record<string, unknown>): RenewalInfo | null {
  const originalTransactionId = str(payload.originalTransactionId);
  const signedAtMs = num(payload.signedDate);
  if (!originalTransactionId || signedAtMs === null) return null;
  return {
    originalTransactionId,
    signedAtMs,
    autoRenew: payload.autoRenewStatus === 1 && payload.isInBillingRetryPeriod !== true,
    graceExpiresAtMs: num(payload.gracePeriodExpiresDate),
  };
}

/** Environment, bundle id and product id against this server's configuration. */
function checkTransaction(tx: Transaction) {
  if (!environmentAccepted(tx.environment)) throw wrongEnvironment(tx.environment);
  if (!env.appStoreBundleIds.includes(tx.bundleId)) {
    throw new AppStoreError("APP_STORE_WRONG_BUNDLE", "The transaction belongs to another app");
  }
  if (!env.appStoreProductIds.includes(tx.productId)) {
    throw new AppStoreError("APP_STORE_WRONG_PRODUCT", "The product isn't a mintsy Premium subscription");
  }
}

// ---- Applying a transaction to a user's entitlement ----

/**
 * applied: stored. stale: older than what's stored for that subscription. skipped: it gives no access and
 * the user's entitlement comes from elsewhere, so there's nothing to change. owned: the subscription is
 * another account's.
 */
type Outcome = "applied" | "stale" | "skipped" | "owned";

interface RenewalFacts {
  autoRenew: boolean;
  graceExpiresAtMs: number | null;
  signedAtMs: number;
}

const accessUntil = (tx: Pick<Transaction, "expiresAtMs">, renewal: RenewalFacts) =>
  Math.max(tx.expiresAtMs, renewal.graceExpiresAtMs ?? 0);

/** What the stored document says about the transaction it's bound to. */
function storedFacts(doc: EntitlementDoc, binding: AppStoreBinding) {
  const tx = {
    transactionId: binding.transactionId,
    environment: binding.environment,
    bundleId: binding.bundleId,
    purchaseAtMs: binding.purchaseAtMs,
    signedAtMs: binding.signedAtMs,
    productId: doc.productId ?? "",
    periodType: doc.periodType ?? "normal",
    expiresAtMs: doc.expiresAt?.getTime() ?? 0,
    voided: binding.voided ?? false,
  };
  const renewal: RenewalFacts = {
    autoRenew: binding.autoRenew ?? doc.willRenew,
    graceExpiresAtMs: doc.graceExpiresAt?.getTime() ?? null,
    signedAtMs: binding.renewalSignedAtMs ?? 0,
  };
  return { tx, renewal };
}

/**
 * Stores a verified, checked transaction (and its renewal info, when the sender had it) for a user.
 *
 * `tokenProof`: the transaction carries this user's appAccountToken, so Apple vouches that the purchase was
 * made for this account. Only then may it take a subscription over from another account; without it the
 * first account to sync a subscription keeps it.
 */
async function applyToUser(
  userId: string,
  incoming: Transaction,
  renewalInfo: RenewalInfo | null,
  tokenProof: boolean,
): Promise<Outcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = Date.now();
    const [doc, holder] = await Promise.all([
      entitlements.findOne({ userId }),
      entitlements.findOne({
        "appStore.originalTransactionId": incoming.originalTransactionId,
        userId: { $ne: userId },
      }),
    ]);
    if (holder?.appStore) {
      if (!tokenProof) return "owned";
      if (incoming.purchaseAtMs < holder.appStore.purchaseAtMs) return "stale";
    }

    const binding = doc?.appStore;
    let tx: ReturnType<typeof storedFacts>["tx"] = incoming;
    let renewal: RenewalFacts;

    if (doc && binding && binding.originalTransactionId === incoming.originalTransactionId) {
      // The same subscription: transaction facts and renewal facts each move forward on their own clock
      if (incoming.purchaseAtMs < binding.purchaseAtMs) return "stale";
      const stored = storedFacts(doc, binding);
      const renewalFresh = renewalInfo !== null && renewalInfo.signedAtMs >= stored.renewal.signedAtMs;
      if (incoming.transactionId === binding.transactionId) {
        const txFresh = incoming.signedAtMs >= binding.signedAtMs;
        if (!txFresh && !renewalFresh) return "stale";
        if (!txFresh) tx = stored.tx;
        renewal = renewalFresh ? renewalInfo : stored.renewal;
      } else {
        // A new period. Without renewal info (a sync from the app), a fresh period renews until told otherwise
        renewal = renewalFresh
          ? renewalInfo
          : { autoRenew: true, graceExpiresAtMs: null, signedAtMs: stored.renewal.signedAtMs };
      }
    } else {
      // The user has no entitlement, a RevenueCat one, or another App Store subscription
      renewal = renewalInfo ?? { autoRenew: true, graceExpiresAtMs: null, signedAtMs: 0 };
      if (incoming.voided || accessUntil(incoming, renewal) <= now) return "skipped";
      // A sandbox purchase never replaces a live production subscription
      if (doc && binding?.environment === "Production" && incoming.environment !== "Production" && toPremium(doc, now).active) {
        return "skipped";
      }
    }

    const active = !tx.voided && accessUntil(tx, renewal) > now;
    const updatedAt = new Date(now);
    const state = {
      active,
      productId: tx.productId,
      periodType: tx.periodType,
      expiresAt: new Date(tx.expiresAtMs),
      graceExpiresAt: renewal.graceExpiresAtMs === null ? null : new Date(renewal.graceExpiresAtMs),
      willRenew: active && renewal.autoRenew,
      store: "app_store",
      updatedAt,
      appStore: {
        originalTransactionId: incoming.originalTransactionId,
        transactionId: tx.transactionId,
        environment: tx.environment,
        bundleId: tx.bundleId,
        purchaseAtMs: tx.purchaseAtMs,
        signedAtMs: tx.signedAtMs,
        renewalSignedAtMs: renewal.signedAtMs,
        autoRenew: renewal.autoRenew,
        voided: tx.voided,
      } satisfies AppStoreBinding,
    };

    try {
      if (holder?.appStore) {
        // Apple signed this purchase for this user: the other account lets the subscription go
        await entitlements.updateOne(
          { _id: holder._id, "appStore.originalTransactionId": incoming.originalTransactionId },
          { $set: { active: false, willRenew: false, updatedAt }, $unset: { appStore: "" } },
        );
      }
      if (doc) {
        // Only if nobody changed it since it was read; otherwise decide again
        const res = await entitlements.updateOne({ _id: doc._id, updatedAt: doc.updatedAt }, { $set: state });
        if (res.matchedCount === 1) return "applied";
      } else {
        await entitlements.insertOne({ userId, ...state });
        return "applied";
      }
    } catch (err) {
      // A concurrent write took the userId or the subscription; decide again
      if (!isDuplicateKey(err)) throw err;
    }
  }
  throw new Error("The entitlement kept changing while an App Store transaction was applied");
}

// ---- syncAppStoreTransaction ----

/**
 * Verifies a signed transaction from the app and stores it for the user. Returns the user's Premium.
 * Throws AppStoreError when the transaction can't be taken. A valid transaction that changes nothing
 * (older than what's stored, expired, refunded) isn't an error: the current Premium is returned, so the
 * app can finish the transaction.
 *
 * A transaction without an appAccountToken (bought outside the app: an offer code redeemed in the App
 * Store, a promoted purchase, Family Sharing) is accepted for whoever syncs it first.
 */
export async function syncAppStoreTransaction(userId: string, signedTransaction: string): Promise<Premium> {
  const tx = parseTransaction(readSigned(signedTransaction));
  checkTransaction(tx);
  const tokenProof = tx.appAccountToken !== null;
  if (tokenProof && tx.appAccountToken !== (await appAccountTokenFor(userId))) {
    throw new AppStoreError("APP_STORE_WRONG_ACCOUNT", "This purchase was made for another mintsy account");
  }
  if ((await applyToUser(userId, tx, null, tokenProof)) === "owned") {
    throw new AppStoreError(
      "APP_STORE_SUBSCRIPTION_IN_USE",
      "This App Store subscription already unlocks another mintsy account",
    );
  }
  return getPremium(userId);
}

// ---- App Store Server Notifications V2 ----

type NotificationResult = { status: "ok" } | { status: "ignored"; reason: string };

interface Notification {
  uuid: string;
  type: string;
  transaction: Transaction;
  renewal: RenewalInfo | null;
}

/** Verifies the notification and what it carries. Returns the reason instead when it isn't for us. */
function readNotification(signedPayload: string): Notification | string {
  // Never the unverified path: Xcode doesn't send notifications
  const payload = verifyAppStoreJws(signedPayload);
  const type = str(payload.notificationType);
  const uuid = str(payload.notificationUUID);
  if (!type || !uuid) throw new AppStoreJwsError("malformed", "Not an App Store Server Notification V2");
  if (type === "TEST") return "test notification";

  const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as Record<string, unknown>;
  const environment = str(data.environment);
  if (!environment || isLocalEnvironment(environment) || !environmentAccepted(environment)) {
    return `environment ${environment ?? "unknown"} isn't accepted`;
  }
  // appAppleId is only sent in Production
  if (env.appStoreAppAppleId && environment === "Production" && String(data.appAppleId ?? "") !== env.appStoreAppAppleId) {
    return "another app";
  }
  if (!env.appStoreBundleIds.includes(str(data.bundleId) ?? "")) return "another app";

  const signedTransaction = str(data.signedTransactionInfo);
  if (!signedTransaction) return "no transaction";
  const signedRenewal = str(data.signedRenewalInfo);
  let transaction: Transaction;
  try {
    transaction = parseTransaction(verifyAppStoreJws(signedTransaction));
    checkTransaction(transaction);
  } catch (err) {
    if (err instanceof AppStoreError) return err.message;
    throw err;
  }
  if (transaction.environment !== environment) return "the transaction's environment differs";
  const renewal = signedRenewal ? parseRenewalInfo(verifyAppStoreJws(signedRenewal)) : null;
  return {
    uuid,
    type: str(payload.subtype) ? `${type}/${payload.subtype as string}` : type,
    transaction,
    renewal: renewal?.originalTransactionId === transaction.originalTransactionId ? renewal : null,
  };
}

/** The account a notification is about: by its appAccountToken, otherwise whoever holds the subscription. */
async function userForTransaction(tx: Transaction): Promise<string | null> {
  if (tx.appAccountToken) return userIdForToken(tx.appAccountToken);
  const holder = await entitlements.findOne(
    { "appStore.originalTransactionId": tx.originalTransactionId },
    { projection: { userId: 1 } },
  );
  return holder?.userId ?? null;
}

async function handleNotification(req: Request, res: Response) {
  const signedPayload = (req.body as { signedPayload?: unknown } | undefined)?.signedPayload;
  if (typeof signedPayload !== "string" || !signedPayload) {
    res.status(400).json({ error: "Missing signedPayload" });
    return;
  }

  let notification: Notification | string;
  try {
    notification = readNotification(signedPayload);
  } catch (err) {
    if (!(err instanceof AppStoreJwsError)) throw err;
    console.warn(`App Store notification rejected (${err.reason}): ${err.message}`);
    res.status(err.reason === "malformed" ? 400 : 401).json({ error: "Invalid signedPayload" });
    return;
  }

  // Apple retries anything but a 2xx, so what isn't for us is answered with 200
  const ignore = (reason: string, what = "notification") => {
    console.log(`App Store ${what}: ignored (${reason})`);
    res.status(200).json({ status: "ignored", reason } satisfies NotificationResult);
  };
  if (typeof notification === "string") return ignore(notification);
  const { uuid, type, transaction, renewal } = notification;
  const what = `${type} ${uuid}`;

  const userId = await userForTransaction(transaction);
  if (!userId) return ignore("no account for this subscription", what);

  // Claim the UUID; a duplicate delivery hits the unique _id
  try {
    await appStoreNotifications.insertOne({ _id: uuid, type, receivedAt: new Date() });
  } catch (err) {
    if (isDuplicateKey(err)) return ignore("duplicate notification", what);
    throw err;
  }

  try {
    const outcome = await applyToUser(userId, transaction, renewal, transaction.appAccountToken !== null);
    if (outcome === "applied") {
      console.log(`App Store ${what}: applied`);
      res.status(200).json({ status: "ok" } satisfies NotificationResult);
      return;
    }
    const reasons = {
      stale: "older than the stored state",
      skipped: "nothing to change",
      owned: "the subscription belongs to another account",
    };
    ignore(reasons[outcome], what);
  } catch (err) {
    // Release the UUID so Apple's retry is processed
    await appStoreNotifications.deleteOne({ _id: uuid }).catch(() => {});
    console.error(`App Store ${what}: failed`, err);
    res.status(500).json({ error: "Processing failed" });
  }
}

/**
 * POST /webhooks/app-store. Mount with app.use() before express.json(); it has its own JSON parser.
 * There's no shared secret: Apple's signature on the payload is the authentication.
 */
export const appStoreWebhook = express.Router();
appStoreWebhook.post("/webhooks/app-store", express.json({ limit: "1mb" }), (req, res, next) => {
  handleNotification(req, res).catch(next);
});

// ---- App Store Server API (refreshPremium) ----

export const appStoreServerApiConfigured = () =>
  Boolean(env.appStoreIssuerId && env.appStoreKeyId && env.appStorePrivateKey);

const SERVER_API_HOSTS: Record<string, string> = {
  Production: "https://api.storekit.itunes.apple.com",
  Sandbox: "https://api.storekit-sandbox.itunes.apple.com",
};

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** The ES256 bearer token the App Store Server API wants, valid for five minutes. */
function serverApiToken(bundleId: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const input =
    b64url({ alg: "ES256", kid: env.appStoreKeyId, typ: "JWT" }) +
    "." +
    b64url({ iss: env.appStoreIssuerId, iat, exp: iat + 300, aud: "appstoreconnect-v1", bid: bundleId });
  const key = createPrivateKey(env.appStorePrivateKey!);
  return `${input}.${sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

interface StatusResponse {
  data?: { lastTransactions?: { originalTransactionId?: string; signedTransactionInfo?: string; signedRenewalInfo?: string }[] }[];
}

/**
 * GET /inApps/v1/subscriptions/{transactionId}: the subscription's latest transaction and renewal info,
 * applied like a notification. Xcode / LocalTesting subscriptions have no server to ask.
 */
async function refreshFromAppStore(userId: string, binding: AppStoreBinding) {
  const host = SERVER_API_HOSTS[binding.environment];
  if (!host) return;
  const res = await fetch(`${host}/inApps/v1/subscriptions/${encodeURIComponent(binding.originalTransactionId)}`, {
    headers: { Authorization: `Bearer ${serverApiToken(binding.bundleId)}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`App Store Server API GET /subscriptions returned ${res.status}`);
  const body = (await res.json()) as StatusResponse;
  const last = (body.data ?? [])
    .flatMap((group) => group.lastTransactions ?? [])
    .find((item) => item.originalTransactionId === binding.originalTransactionId);
  if (!last?.signedTransactionInfo) return;

  const tx = parseTransaction(verifyAppStoreJws(last.signedTransactionInfo));
  checkTransaction(tx);
  if (tx.originalTransactionId !== binding.originalTransactionId) return;
  // Resubscribed from another mintsy account since: that account's sync or notification takes it over
  if (tx.appAccountToken && tx.appAccountToken !== (await appAccountTokenFor(userId))) return;
  const renewal = last.signedRenewalInfo ? parseRenewalInfo(verifyAppStoreJws(last.signedRenewalInfo)) : null;
  await applyToUser(userId, tx, renewal?.originalTransactionId === tx.originalTransactionId ? renewal : null, false);
}

/**
 * The refreshPremium mutation. An App Store entitlement is refetched from Apple when the App Store Server
 * API credentials are set (a failure is logged and the stored state returned, which Apple signed too).
 * Everything else, and an App Store subscription that has ended, goes to RevenueCat as before.
 */
export async function refreshPremium(userId: string): Promise<Premium> {
  const doc = await entitlements.findOne({ userId });
  if (!doc?.appStore) return refreshRevenueCatPremium(userId);

  if (appStoreServerApiConfigured()) {
    try {
      await refreshFromAppStore(userId, doc.appStore);
    } catch (err) {
      console.warn("refreshPremium: the App Store refetch failed; returning the stored entitlement", err);
    }
  }
  const premium = await getPremium(userId);
  if (premium.active || !revenueCatRestConfigured()) return premium;

  // The App Store subscription is over; a web purchase may still give access. RevenueCat's "nothing" isn't
  // stored, so the ended subscription stays bound and its notifications (a resubscribe) still find the user
  const state = await fetchSubscriberState(userId);
  if (!state.active) return premium;
  await storeEntitlement(userId, state);
  return getPremium(userId);
}
