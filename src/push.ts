import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { db } from "./db.js";
import { env } from "./env.js";

interface PushTokenDoc {
  token: string;
  userId: string;
  platform: string;
  updatedAt: Date;
}

const expo = new Expo({ accessToken: env.expoAccessToken });
const pushTokens = db.collection<PushTokenDoc>("pushTokens");

export async function ensurePushIndexes() {
  // A device token belongs to one user at a time (the last one to sign in on that device)
  await pushTokens.createIndex({ token: 1 }, { unique: true });
  await pushTokens.createIndex({ userId: 1 });
}

export function isValidPushToken(token: string) {
  return Expo.isExpoPushToken(token);
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

/** Sends a notification to every device registered for the user. Returns the number of devices targeted. */
export async function sendPushToUser(
  userId: string,
  notification: Pick<ExpoPushMessage, "title" | "body" | "data">,
) {
  const tokens = await pushTokens.find({ userId }).map((doc) => doc.token).toArray();
  if (tokens.length === 0) return 0;

  const messages: ExpoPushMessage[] = tokens.map((to) => ({ to, sound: "default", ...notification }));

  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    // Drop tokens Expo reports as no longer registered (app uninstalled, etc.)
    const stale = tickets.flatMap((ticket, i) =>
      ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
        ? [chunk[i]!.to as string]
        : [],
    );
    if (stale.length) await pushTokens.deleteMany({ token: { $in: stale } });
  }

  return tokens.length;
}
