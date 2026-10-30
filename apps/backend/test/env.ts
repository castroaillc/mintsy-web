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
    SIGNED_MEDIA: "",
    ...overrides,
  });
}

export const randomId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
