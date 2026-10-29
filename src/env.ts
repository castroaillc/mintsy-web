import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: required("MONGODB_URI"),
  // Optional: overrides the database name in MONGODB_URI
  mongodbDb: process.env.MONGODB_DB || undefined,
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl: required("BETTER_AUTH_URL"),
  // Optional: only needed if "enhanced push security" is enabled for the Expo project
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  // Public base URL of the media bucket; episode video and thumbnail paths are appended to it
  mediaBaseUrl: (process.env.MEDIA_BASE_URL || "https://storage.googleapis.com/mintsy-media").replace(/\/$/, ""),
  // Name of the media bucket, used when SIGNED_MEDIA is on
  mediaBucket: process.env.MEDIA_BUCKET || "mintsy-media",
  // When true, videoUrl / thumbnailUrl are short-lived GCS V4 signed URLs (the bucket is private).
  // Off by default: plain MEDIA_BASE_URL + path, which needs a public bucket.
  signedMedia: process.env.SIGNED_MEDIA === "true",
  // RevenueCat webhook Authorization header value; the webhook answers 503 while it's unset
  revenueCatWebhookAuth: process.env.REVENUECAT_WEBHOOK_AUTH || undefined,
  // RevenueCat secret API key (server-side only) for GET /v1/subscribers; without it, entitlements
  // come from webhook payloads only and refreshPremium returns the stored entitlement
  revenueCatSecretApiKey: process.env.REVENUECAT_SECRET_API_KEY || undefined,
  // Resend API key for transactional email (password reset, email change). Unset = emails are logged, not sent
  resendApiKey: process.env.RESEND_API_KEY || undefined,
  // Sender for transactional email; its domain must be verified in Resend
  emailFrom: process.env.EMAIL_FROM || "mintsy <no-reply@getmintsy.com>",
  corsOrigins:(process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
