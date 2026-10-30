// Integration test for POST /api/auth/delete-user (password vs. social-only users).
// Needs a local MongoDB replica set (docker compose up -d). Run: pnpm test
// Uses its own database (TEST_MONGODB_URI, default mintsy-test on localhost) and refuses non-local hosts.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

const uri = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/mintsy-test?directConnection=true";
const host = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
if (!["localhost", "127.0.0.1", "::1", "mongo", "host.docker.internal"].includes(host)) {
  throw new Error(`Refusing to run the account test against non-local MongoDB host ${host}`);
}
// Set before importing the app (src/env.ts reads these at import; dotenv doesn't override set vars)
Object.assign(process.env, {
  MONGODB_URI: uri,
  MONGODB_DB: "",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:4999",
  CORS_ORIGINS: "",
  RESEND_API_KEY: "",
  REVENUECAT_SECRET_API_KEY: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_IOS_CLIENT_ID: "",
  APPLE_CLIENT_ID: "",
});

const { ObjectId } = await import("mongodb");
const { auth } = await import("../src/auth.js");
const { client, db } = await import("../src/db.js");

const password = "password1234";

async function signUp() {
  const email = `account-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { headers, response } = await auth.api.signUpEmail({
    body: { email, password, name: "Account Test" },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const userId = response.user.id;
  // Something the cleanup hooks must remove
  await db.collection("saved_items").insertOne({ userId, kind: "book", id: "some-book", savedAt: new Date() });
  return { userId, cookie, token: response.token! };
}

const userIds = (userId: string) => [userId, new ObjectId(userId)] as unknown[] as InstanceType<typeof ObjectId>[];

/** Turn a password user into a social-only one (as if they had signed up with Google). */
async function makeSocialOnly(userId: string) {
  await db.collection("account").deleteMany({ userId: { $in: userIds(userId) }, providerId: "credential" });
  await db.collection("account").insertOne({
    userId: new ObjectId(userId),
    providerId: "google",
    accountId: `google-${userId}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function ageSession(token: string, minutes: number) {
  await db.collection("session").updateOne({ token }, { $set: { createdAt: new Date(Date.now() - minutes * 60_000) } });
}

async function deleteUser(cookie: string, body: Record<string, unknown>) {
  // Through the HTTP handler, as the app calls it
  const res = await auth.handler(
    new Request("http://localhost:4999/api/auth/delete-user", {
      method: "POST",
      headers: { "content-type": "application/json", "expo-origin": "mintsy://", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
  const json = (await res.json().catch(() => null)) as { code?: string } | null;
  return { status: res.status, code: json?.code };
}

async function userExists(userId: string) {
  return (await db.collection("user").countDocuments({ _id: { $in: userIds(userId) } })) > 0;
}

async function savedCount(userId: string) {
  return db.collection("saved_items").countDocuments({ userId });
}

describe("delete-user", () => {
  before(async () => {
    await client.connect();
  });
  after(async () => {
    await client.close();
  });

  test("password user: password is required", async () => {
    const { userId, cookie } = await signUp();
    assert.deepEqual(await deleteUser(cookie, {}), { status: 400, code: "PASSWORD_REQUIRED" });
    assert.deepEqual(await deleteUser(cookie, { password: "wrong-password" }), { status: 400, code: "INVALID_PASSWORD" });
    assert.equal(await userExists(userId), true);
  });

  test("password user: deletes with the password, even from an old session", async () => {
    const { userId, cookie, token } = await signUp();
    await ageSession(token, 60);
    assert.equal((await deleteUser(cookie, { password })).status, 200);
    assert.equal(await userExists(userId), false);
    assert.equal(await savedCount(userId), 0);
  });

  test("social-only user: deletes without a password from a fresh session", async () => {
    const { userId, cookie, token } = await signUp();
    await makeSocialOnly(userId);
    await ageSession(token, 5);
    assert.equal((await deleteUser(cookie, {})).status, 200);
    assert.equal(await userExists(userId), false);
    assert.equal(await savedCount(userId), 0);
  });

  test("social-only user: an old session gets REAUTH_REQUIRED", async () => {
    const { userId, cookie, token } = await signUp();
    await makeSocialOnly(userId);
    await ageSession(token, 11);
    assert.deepEqual(await deleteUser(cookie, {}), { status: 403, code: "REAUTH_REQUIRED" });
    assert.equal(await userExists(userId), true);
    assert.equal(await savedCount(userId), 1);
    // Clean up
    await ageSession(token, 0);
    assert.equal((await deleteUser(cookie, {})).status, 200);
  });

  test("signed out: 401", async () => {
    assert.equal((await deleteUser("", {})).status, 401);
  });
});
