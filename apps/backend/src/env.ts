import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function list(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * The web app (mintsy-web, Next.js). The browser only talks to its own origin: Next.js rewrites
 * /api/auth/* and /graphql to this API, so session cookies are first-party on the web app's host.
 * localhost:3000 (next dev) is only trusted outside production.
 */
const WEB_ORIGINS = ["https://app.getmintsy.com", ...(isProduction ? [] : ["http://localhost:3000"])];

export const env = {
  isProduction,
  webOrigins: WEB_ORIGINS,
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
  // Sign in with Google (native ID-token flow). Enabled when GOOGLE_CLIENT_ID or GOOGLE_IOS_CLIENT_ID is set.
  // ID tokens are accepted with either client ID as their audience (the iOS app's tokens carry the iOS one).
  googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
  // Comma-separated: iOS clients are per bundle ID (com.getmintsy.app, com.getmintsy.app.dev)
  googleIosClientIds: list(process.env.GOOGLE_IOS_CLIENT_ID ?? ""),
  // Only needed for the browser redirect flow, not for native ID tokens
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
  // Sign in with Apple. Enabled when APPLE_CLIENT_ID (the Services ID) is set.
  appleClientId: process.env.APPLE_CLIENT_ID || undefined,
  // Only needed for the browser redirect flow, not for native ID tokens
  appleClientSecret: process.env.APPLE_CLIENT_SECRET || undefined,
  // Native ID tokens carry the app's bundle ID as their audience; comma-separated, defaults to prod + dev builds
  appleAppBundleIdentifiers: list(process.env.APPLE_APP_BUNDLE_IDENTIFIER || "com.getmintsy.app,com.getmintsy.app.dev"),
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
