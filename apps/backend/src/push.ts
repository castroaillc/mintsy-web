import crypto from "node:crypto";
import http2 from "node:http2";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { db, ensureIndexes } from "./db.js";
import { env } from "./env.js";

interface PushTokenDoc {
  token: string;
  userId: string;
  /**
   * expo: Expo push token (ExponentPushToken[…])
   * ios: native APNs device token (64 hex chars), production endpoint
   * ios-dev: native APNs device token, sandbox endpoint
   */
  platform: string;
  updatedAt: Date;
}

const expo = new Expo({ accessToken: env.expoAccessToken });
const pushTokens = db.collection<PushTokenDoc>("pushTokens");

export async function ensurePushIndexes() {
  // A device token belongs to one user at a time (the last one to sign in on that device)
  await ensureIndexes(pushTokens, [{ key: { token: 1 }, unique: true }, { key: { userId: 1 } }]);
}

const APNS_TOKEN_RE = /^[0-9a-f]{64}$/;

export function isValidPushToken(token: string) {
  return Expo.isExpoPushToken(token) || APNS_TOKEN_RE.test(token);
}

export async function registerPushToken(userId: string, token: string, platform: string) {
  await pushTokens.updateOne(
    { token },
    { $set: { userId, platform, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function unregisterPushToken(userId: string, token: string) {
  await pushTokens.deleteOne({ token, userId });
}

export async function deletePushTokensForUser(userId: string) {
  return (await pushTokens.deleteMany({ userId })).deletedCount;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signs an APNs provider JWT (ES256). Apple requires a fresh one per request or at most hourly. */
function makeApnsJwt(keyId: string, teamId: string, privateKeyPem: string): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = base64url(Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })));
  const data = `${header}.${payload}`;
  const sign = crypto.createSign("SHA256");
  sign.update(data);
  // ieee-p1363 produces the raw r||s bytes that JWT ES256 expects (instead of DER)
  const sig = base64url(sign.sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" }));
  return `${data}.${sig}`;
}

type ApnsResult = "ok" | "gone" | "error";

/** Delivers one notification to a native APNs device token over HTTP/2. */
async function sendToApnsToken(
  token: string,
  sandbox: boolean,
  bundleId: string,
  keyId: string,
  teamId: string,
  authKey: string,
  notification: Pick<ExpoPushMessage, "title" | "body" | "data">,
): Promise<ApnsResult> {
  const authority = sandbox
    ? "https://api.development.push.apple.com"
    : "https://api.push.apple.com";

  const jwt = makeApnsJwt(keyId, teamId, authKey);

  const payload = JSON.stringify({
    aps: { alert: { title: notification.title, body: notification.body }, sound: "default" },
    ...((notification.data as Record<string, unknown>) ?? {}),
  });

  return new Promise<ApnsResult>((resolve) => {
    const session = http2.connect(authority);

    session.once("error", () => { session.destroy(); resolve("error"); });

    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
    });

    let statusCode = 0;
    req.on("response", (headers) => { statusCode = Number(headers[":status"]); });
    req.on("data", () => {});
    req.on("end", () => { session.close(); resolve(statusCode === 200 ? "ok" : statusCode === 410 ? "gone" : "error"); });
    req.on("error", () => { session.destroy(); resolve("error"); });

    req.end(payload);
  });
}

/** Sends a notification to every device registered for the user. Returns the number of devices targeted. */
export async function sendPushToUser(
  userId: string,
  notification: Pick<ExpoPushMessage, "title" | "body" | "data">,
) {
  const docs = await pushTokens.find({ userId }).toArray();
  if (docs.length === 0) return 0;

  const expoDocs = docs.filter((d) => Expo.isExpoPushToken(d.token));
  const apnsDocs = docs.filter((d) => APNS_TOKEN_RE.test(d.token));

  if (expoDocs.length) {
    const messages: ExpoPushMessage[] = expoDocs.map((d) => ({ to: d.token, sound: "default", ...notification }));
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      const stale = tickets.flatMap((ticket, i) =>
        ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
          ? [chunk[i]!.to as string]
          : [],
      );
      if (stale.length) await pushTokens.deleteMany({ token: { $in: stale } });
    }
  }

  if (apnsDocs.length) {
    const { apnsKeyId, apnsTeamId, apnsAuthKey } = env;
    if (!apnsKeyId || !apnsTeamId || !apnsAuthKey) {
      console.warn("[push] APNs credentials not configured; skipping native token(s)");
    } else {
      const bundleId = env.apnsBundleId ?? env.appleAppBundleIdentifiers[0] ?? "";
      const gone: string[] = [];
      await Promise.all(
        apnsDocs.map(async (doc) => {
          const result = await sendToApnsToken(
            doc.token,
            doc.platform === "ios-dev",
            bundleId,
            apnsKeyId,
            apnsTeamId,
            apnsAuthKey,
            notification,
          );
          if (result === "gone") gone.push(doc.token);
        }),
      );
      if (gone.length) await pushTokens.deleteMany({ token: { $in: gone } });
    }
  }

  return docs.length;
}
