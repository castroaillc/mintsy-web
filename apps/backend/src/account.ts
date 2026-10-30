import { db } from "./db.js";
import { entitlements } from "./entitlements.js";
import { env } from "./env.js";
import { deleteProgressForUser } from "./progress.js";
import { deletePushTokensForUser } from "./push.js";
import { deleteSavedForUser } from "./saved.js";

/**
 * Deletes everything we store about a user outside Better Auth's own user/session/account
 * documents (Better Auth deletes those). Idempotent; called before and again after the
 * Better Auth deletion so nothing written in between is left behind.
 */
export async function deleteUserData(userId: string) {
  const [pushTokens, entitlementDocs, saved, progress, verifications] = await Promise.all([
    deletePushTokensForUser(userId),
    entitlements.deleteMany({ userId }).then((r) => r.deletedCount),
    deleteSavedForUser(userId),
    deleteProgressForUser(userId),
    // Pending reset-password / delete-account tokens point at the user id
    db.collection("verification").deleteMany({ value: userId }).then((r) => r.deletedCount),
  ]);
  return { pushTokens, entitlements: entitlementDocs, saved, progress, verifications };
}

/**
 * DELETE https://api.revenuecat.com/v1/subscribers/{app_user_id} (deletion is queued by RevenueCat).
 * Doesn't cancel a store subscription. Logs and continues on failure; 404 counts as deleted.
 */
export async function deleteRevenueCatSubscriber(userId: string) {
  const key = env.revenueCatSecretApiKey;
  if (!key) return;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 404) {
      console.error(`[account] RevenueCat DELETE /subscribers failed for user ${userId}: ${res.status}`);
    }
  } catch (err) {
    console.error(`[account] RevenueCat DELETE /subscribers failed for user ${userId}:`, err);
  }
}
