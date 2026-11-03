// One code base, two services: with mintsy-api-preview's env vars the API stays on its own host and databases and
// doesn't trust the production web app. Production's defaults are covered by web-auth.test.ts.
// Needs a local MongoDB replica set. Run: pnpm test
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

const API = "https://mintsy-api-preview-123456789.us-central1.run.app";
const appDb = randomId("mintsy-test-preview-app");
const catalog = randomId("mintsy-test-preview-catalog");

useTestEnv({
  BETTER_AUTH_URL: API,
  MONGODB_DB: appDb,
  MONGODB_CATALOG_DB: catalog,
  WEB_ORIGINS: "",
  APPLE_CLIENT_ID: "com.getmintsy.signin",
  APPLE_APP_BUNDLE_IDENTIFIER: "com.getmintsy.app.preview",
});

const { auth } = await import("../src/auth.js");
const { catalogDb, client, db } = await import("../src/db.js");
const { env } = await import("../src/env.js");

function request(path: string, headers: Record<string, string>, body: unknown) {
  return auth.handler(
    new Request(`${API}/api/auth${path}`, {
      method: "POST",
      headers: { host: new URL(API).host, "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

const APP = { "expo-origin": "mintsy-preview://" };
const logged: string[] = [];
const realLog = console.log;

async function emailedLink(to: string) {
  for (let i = 0; i < 100; i++) {
    const link = logged.find((line) => line.includes(`to=${to} `))?.match(/link: (\S+)/)?.[1];
    if (link) return new URL(link);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`no email logged for ${to}`);
}

async function signUp() {
  const email = `${randomId("preview")}@example.com`;
  const res = await request("/sign-up/email", APP, { email, password: "password1234", name: "Preview" });
  assert.equal(res.status, 200);
  return { email, res };
}

describe("the preview service's configuration", () => {
  before(async () => {
    await client.connect();
    console.log = (...args: unknown[]) => {
      logged.push(args.join(" "));
    };
  });
  after(async () => {
    console.log = realLog;
    await db.dropDatabase();
    await catalogDb.dropDatabase();
    await client.close();
  });

  test("env vars pick the databases, hosts and bundle IDs", () => {
    assert.equal(db.databaseName, appDb);
    assert.equal(catalogDb.databaseName, catalog);
    assert.deepEqual(env.webOrigins, []);
    assert.deepEqual(auth.options.socialProviders.apple?.audience, ["com.getmintsy.app.preview", "com.getmintsy.signin"]);
    assert.deepEqual((auth.options.baseURL as { allowedHosts: string[] }).allowedHosts, [new URL(API).host]);
  });

  test("users go in the preview app database and not the catalog database", async () => {
    const { email } = await signUp();
    assert.equal(await db.collection("user").countDocuments({ email }), 1);
    assert.deepEqual(await catalogDb.listCollections().toArray(), []);
  });

  test("email links point at the preview host, even when a request claims a production host", async () => {
    for (const forwarded of [undefined, "app.getmintsy.com", "api.getmintsy.com"]) {
      const { email } = await signUp();
      const res = await request(
        "/request-password-reset",
        { ...APP, ...(forwarded ? { "x-forwarded-host": forwarded } : {}) },
        { email, redirectTo: "mintsy-preview://reset-password" },
      );
      assert.equal(res.status, 200);
      const link = await emailedLink(email);
      assert.equal(link.origin, API, `x-forwarded-host: ${forwarded}`);
      assert.equal(link.searchParams.get("callbackURL"), "mintsy-preview://reset-password");
    }
  });

  test("the session cookie stays host-only and __Secure-", async () => {
    const { res } = await signUp();
    const session = res.headers.getSetCookie().find((c) => c.startsWith("__Secure-better-auth.session_token="));
    assert.ok(session);
    assert.doesNotMatch(session, /Domain=/i);
  });

  test("the production web app isn't trusted", async () => {
    const web = { origin: "https://app.getmintsy.com" };
    const { email } = await signUp();
    assert.equal((await request("/sign-in/email", web, { email, password: "password1234" })).status, 403);
    assert.equal(
      (await request("/request-password-reset", APP, { email, redirectTo: "https://app.getmintsy.com/reset-password" })).status,
      403,
    );
  });
});
