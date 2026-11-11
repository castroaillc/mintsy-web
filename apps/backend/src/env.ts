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

/** A number of at least 0 from the environment, or the fallback when it's unset or not one. */
function nonNegative(value: string | undefined, fallback: number): number {
  const n = value?.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const isProduction = process.env.NODE_ENV === "production";

const APP_STORE_ENVIRONMENT_NAMES = ["Production", "Sandbox", "Xcode", "LocalTesting"] as const;
export type AppStoreEnvironment = (typeof APP_STORE_ENVIRONMENT_NAMES)[number];

/**
 * APP_STORE_ENVIRONMENTS: which StoreKit environments' transactions are accepted (default Production,Sandbox).
 * Xcode and LocalTesting transactions are signed by a local test certificate, not by Apple, so they can't be
 * verified. They're only ever accepted outside production, and only when listed here.
 */
function appStoreEnvironments(value: string | undefined): AppStoreEnvironment[] {
  const wanted = list(value || "Production,Sandbox").map((v) => v.toLowerCase());
  return APP_STORE_ENVIRONMENT_NAMES.filter(
    (name) => wanted.includes(name.toLowerCase()) && !(isProduction && (name === "Xcode" || name === "LocalTesting")),
  );
}

/**
 * The web app (mintsy-web, Next.js). The browser only talks to its own origin: Next.js rewrites
 * /api/auth/* and /graphql to this API, so session cookies are first-party on the web app's host.
 * localhost:3000 (next dev) is only trusted outside production.
 *
 * WEB_ORIGINS (comma-separated) replaces this list. Unset keeps the default; set but empty means no web app,
 * which is what a service like mintsy-api-preview wants: nothing there should trust the production site.
 */
const WEB_ORIGINS =
  process.env.WEB_ORIGINS === undefined
    ? ["https://app.getmintsy.com", ...(isProduction ? [] : ["http://localhost:3000"])]
    : list(process.env.WEB_ORIGINS);

export const env = {
  isProduction,
  webOrigins: WEB_ORIGINS,
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: required("MONGODB_URI"),
  // Optional: overrides the database name in MONGODB_URI
  mongodbDb: process.env.MONGODB_DB || undefined,
  // Optional: database holding the catalog (`books`), which this API only reads.
  // Unset = the catalog is in the app database above (see src/db.ts)
  mongodbCatalogDb: process.env.MONGODB_CATALOG_DB || undefined,
  // Optional: how stale the in-process copy of the published catalog may get, in seconds (default 60).
  // 0 turns the cache off, so every read goes to MongoDB (the tests do this). See src/catalog.ts
  catalogCacheSeconds: nonNegative(process.env.CATALOG_CACHE_SECONDS, 60),
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl: required("BETTER_AUTH_URL"),
  // Optional: only needed if "enhanced push security" is enabled for the Expo project
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  // APNs (Apple Push Notification service) direct delivery for native iOS tokens.
  // All three set = native APNs tokens are delivered; unset = skipped with a warning
  apnsKeyId: process.env.APNS_KEY_ID || undefined,
  apnsTeamId: process.env.APNS_TEAM_ID || undefined,
  apnsAuthKey: process.env.APNS_AUTH_KEY?.replace(/\\n/g, "\n") || undefined,
  // apns-topic for outgoing notifications; defaults to the first APPLE_APP_BUNDLE_IDENTIFIER
  apnsBundleId: process.env.APNS_BUNDLE_ID || undefined,
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
  // Comma-separated: iOS clients are per bundle ID (com.getmintsy.app, com.getmintsy.app.dev, com.getmintsy.app.preview)
  googleIosClientIds: list(process.env.GOOGLE_IOS_CLIENT_ID ?? ""),
  // Only needed for the browser redirect flow, not for native ID tokens
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
  // Sign in with Apple. Enabled when APPLE_CLIENT_ID (the Services ID) is set.
  appleClientId: process.env.APPLE_CLIENT_ID || undefined,
  // Only needed for the browser redirect flow, not for native ID tokens
  appleClientSecret: process.env.APPLE_CLIENT_SECRET || undefined,
  // Native ID tokens carry the app's bundle ID as their audience; comma-separated, defaults to all three app variants
  appleAppBundleIdentifiers: list(
    process.env.APPLE_APP_BUNDLE_IDENTIFIER || "com.getmintsy.app,com.getmintsy.app.dev,com.getmintsy.app.preview",
  ),
  // App Store (StoreKit 2) purchases. Bundle IDs whose transactions and notifications are accepted; defaults to
  // the Sign in with Apple list above, so one variable narrows both for a service like the preview API
  appStoreBundleIds: list(
    process.env.APP_STORE_BUNDLE_IDS ||
      process.env.APPLE_APP_BUNDLE_IDENTIFIER ||
      "com.getmintsy.app,com.getmintsy.app.dev,com.getmintsy.app.preview",
  ),
  // Subscription product ids that grant Premium
  appStoreProductIds: list(process.env.APP_STORE_PRODUCT_IDS || "mintsy_premium_monthly,mintsy_premium_yearly"),
  // Accepted StoreKit environments; see appStoreEnvironments above
  appStoreEnvironments: appStoreEnvironments(process.env.APP_STORE_ENVIRONMENTS),
  // True when APP_STORE_ENVIRONMENTS asked for Xcode or LocalTesting in production, where they're refused
  appStoreLocalEnvironmentsRefused:
    isProduction && /xcode|localtesting/i.test(process.env.APP_STORE_ENVIRONMENTS ?? ""),
  // App Store Server API credentials (App Store Connect -> Users and Access -> Integrations -> In-App Purchase).
  // All three set = refreshPremium refetches an App Store subscription from Apple; otherwise it returns what's stored
  appStoreIssuerId: process.env.APP_STORE_ISSUER_ID || undefined,
  appStoreKeyId: process.env.APP_STORE_KEY_ID || undefined,
  // The .p8 file's contents; line breaks may be written as \n
  appStorePrivateKey: process.env.APP_STORE_PRIVATE_KEY?.replace(/\\n/g, "\n") || undefined,
  // The app's numeric Apple ID. When set, Production notifications for any other app are ignored
  appStoreAppAppleId: process.env.APP_STORE_APP_APPLE_ID || undefined,
  // Sign in with Apple key, used to sign the client_secret for Apple's token and revoke endpoints (exchanging
  // the app's authorization code at sign-in, revoking the token on account deletion). Unset key = both are off.
  appleTeamId: process.env.APPLE_TEAM_ID || "9496L7QUB2",
  appleKeyId: process.env.APPLE_KEY_ID || undefined,
  // The .p8 contents (PEM). Literal "\n" sequences are accepted for single-line values.
  applePrivateKey: process.env.APPLE_PRIVATE_KEY ? process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n").trim() : undefined,
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
