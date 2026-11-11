// Shared test environment. Call before importing anything from src/ (src/env.ts reads the env at import;
// dotenv doesn't override variables that are already set). Each test file runs in its own process.
export function useTestEnv(overrides: Record<string, string> = {}) {
  const uri = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/mintsy-test?directConnection=true";
  const host = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
  if (!["localhost", "127.0.0.1", "::1", "mongo", "host.docker.internal"].includes(host)) {
    throw new Error(`Refusing to run tests against non-local MongoDB host ${host}`);
  }
  Object.assign(process.env, {
    MONGODB_URI: uri,
    MONGODB_DB: "",
    MONGODB_CATALOG_DB: "",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
    BETTER_AUTH_URL: "http://localhost:4999",
    CORS_ORIGINS: "",
    RESEND_API_KEY: "",
    REVENUECAT_SECRET_API_KEY: "",
    REVENUECAT_WEBHOOK_AUTH: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_IOS_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    APPLE_CLIENT_ID: "",
    APPLE_CLIENT_SECRET: "",
    APPLE_KEY_ID: "",
    APPLE_PRIVATE_KEY: "",
    SIGNED_MEDIA: "",
    APP_STORE_BUNDLE_IDS: "",
    APP_STORE_PRODUCT_IDS: "",
    APP_STORE_ENVIRONMENTS: "",
    APP_STORE_ISSUER_ID: "",
    APP_STORE_KEY_ID: "",
    APP_STORE_PRIVATE_KEY: "",
    APP_STORE_APP_APPLE_ID: "",
    APPLE_APP_BUNDLE_IDENTIFIER: "",
    APNS_KEY_ID: "",
    APNS_TEAM_ID: "",
    APNS_AUTH_KEY: "",
    APNS_BUNDLE_ID: "",
    // Tests change the catalog between reads; test/catalog-cache.test.ts turns the cache on
    CATALOG_CACHE_SECONDS: "0",
    ...overrides,
  });
}

export const randomId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
