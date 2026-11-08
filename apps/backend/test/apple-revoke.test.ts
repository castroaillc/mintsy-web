// Sign in with Apple token storage (authorization code exchange at sign-in) and revocation on account deletion.
// Apple's endpoints (JWKS, /auth/token, /auth/revoke) are mocked; nothing goes to the network.
// Needs a local MongoDB replica set. Run: pnpm test
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

const API = "http://localhost:4999";
const BUNDLE_ID = "com.getmintsy.app";

// The Sign in with Apple key (ES256) our server signs client secrets with
const appleKey = generateKeyPairSync("ec", { namedCurve: "P-256" });
// Apple's identity-token signing key (RS256), served from the mocked JWKS
const idTokenKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ID_TOKEN_KID = "test-kid";

useTestEnv({
  MONGODB_DB: randomId("mintsy-test-apple"),
  APPLE_CLIENT_ID: "com.getmintsy.signin",
  APPLE_APP_BUNDLE_IDENTIFIER: "",
  APPLE_TEAM_ID: "",
  APPLE_KEY_ID: "KEY1234567",
  // Single line with literal \n, as it may be stored in an env var
  APPLE_PRIVATE_KEY: (appleKey.privateKey.export({ type: "pkcs8", format: "pem" }) as string).replace(/\n/g, "\\n"),
});

const { auth } = await import("../src/auth.js");
const { client, db } = await import("../src/db.js");
const { env } = await import("../src/env.js");
const { ObjectId } = await import("mongodb");

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

function identityToken(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", kid: ID_TOKEN_KID, typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iss: "https://appleid.apple.com", aud: BUNDLE_ID, iat: now, exp: now + 600, email_verified: true, ...claims }),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), idTokenKey.privateKey);
  return `${header}.${payload}.${b64url(signature)}`;
}

function decodeJwt(token: string) {
  const [h, p, s] = token.split(".");
  return {
    header: JSON.parse(Buffer.from(h!, "base64url").toString()),
    payload: JSON.parse(Buffer.from(p!, "base64url").toString()),
    validEs256: verify("sha256", Buffer.from(`${h}.${p}`), { key: appleKey.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s!, "base64url")),
  };
}

// Mocked Apple endpoints
type Call = { url: string; form: URLSearchParams };
const calls: Call[] = [];
let tokenResponse: (form: URLSearchParams) => Response = () => new Response("{}", { status: 500 });
let revokeResponse: () => Response = () => new Response(null, { status: 200 });
const realFetch = globalThis.fetch;
const jwk = { ...idTokenKey.publicKey.export({ format: "jwk" }), kid: ID_TOKEN_KID, alg: "RS256", use: "sig" };

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://appleid.apple.com/")) return realFetch(input, init);
  if (url === "https://appleid.apple.com/auth/keys") return Response.json({ keys: [jwk] });
  const form = new URLSearchParams(String(init?.body ?? ""));
  calls.push({ url, form });
  if (url === "https://appleid.apple.com/auth/token") return tokenResponse(form);
  if (url === "https://appleid.apple.com/auth/revoke") return revokeResponse();
  return new Response(null, { status: 404 });
}) as typeof fetch;

const tokenCalls = () => calls.filter((c) => c.url.endsWith("/auth/token"));
const revokeCalls = () => calls.filter((c) => c.url.endsWith("/auth/revoke"));

/** Apple's answer to a valid code for `sub`. */
function appleTokens(sub: string, refreshToken = `r.${randomId("refresh")}`) {
  return () =>
    Response.json({
      access_token: `a.${randomId("access")}`,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      id_token: identityToken({ sub }),
    });
}

async function signInWithApple(sub: string, appleAuthorizationCode?: string) {
  const body = {
    provider: "apple",
    idToken: { token: identityToken({ sub, email: `${sub}@privaterelay.appleid.com` }) },
    ...(appleAuthorizationCode ? { additionalData: { appleAuthorizationCode } } : {}),
  };
  const res = await auth.handler(
    new Request(`${API}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", "expo-origin": "mintsy://" },
      body: JSON.stringify(body),
    }),
  );
  const json = (await res.json()) as { user?: { id: string } };
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, userId: json.user?.id, cookie };
}

async function deleteUser(cookie: string) {
  const res = await auth.handler(
    new Request(`${API}/api/auth/delete-user`, {
      method: "POST",
      headers: { "content-type": "application/json", "expo-origin": "mintsy://", cookie },
      body: "{}",
    }),
  );
  return res.status;
}

const appleAccount = (sub: string) => db.collection("account").findOne({ providerId: "apple", accountId: sub });
const userExists = async (userId: string) =>
  (await db.collection("user").countDocuments({ _id: { $in: [userId, new ObjectId(userId)] as unknown as InstanceType<typeof ObjectId>[] } })) > 0;

// The [apple] warnings are expected in some tests; keep them out of the output and make sure no token leaks
const warnings: string[] = [];
const realWarn = console.warn;
const realLog = console.log;

describe("Sign in with Apple token revocation", () => {
  before(async () => {
    await client.connect();
    console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(" "));
    console.log = (...args: unknown[]) => void warnings.push(args.map(String).join(" "));
  });
  beforeEach(() => {
    calls.length = 0;
    tokenResponse = () => new Response("{}", { status: 500 });
    revokeResponse = () => new Response(null, { status: 200 });
  });
  after(async () => {
    console.warn = realWarn;
    console.log = realLog;
    globalThis.fetch = realFetch;
    for (const line of warnings) assert.doesNotMatch(line, /\b[ra]\.[a-z]+-/, "no Apple token in the logs");
    await db.dropDatabase();
    await client.close();
  });

  test("sign-in without a code works as before and calls no Apple token endpoint", async () => {
    const sub = randomId("apple-nocode");
    const { status, userId } = await signInWithApple(sub);
    assert.equal(status, 200);
    assert.ok(userId);
    assert.equal(tokenCalls().length, 0);
    const account = await appleAccount(sub);
    assert.ok(account);
    assert.equal(account.refreshToken ?? null, null);
  });

  test("sign-in with a code exchanges it with the bundle ID and stores the refresh token", async () => {
    const sub = randomId("apple-code");
    tokenResponse = appleTokens(sub, "r.stored-refresh");
    const { status } = await signInWithApple(sub, "c.one-time-code");
    assert.equal(status, 200);

    assert.equal(tokenCalls().length, 1);
    const { form } = tokenCalls()[0]!;
    assert.equal(form.get("client_id"), BUNDLE_ID);
    assert.equal(form.get("code"), "c.one-time-code");
    assert.equal(form.get("grant_type"), "authorization_code");
    const secret = decodeJwt(form.get("client_secret")!);
    assert.equal(secret.validEs256, true);
    assert.deepEqual(secret.header, { alg: "ES256", kid: "KEY1234567", typ: "JWT" });
    assert.equal(secret.payload.iss, "9496L7QUB2");
    assert.equal(secret.payload.sub, BUNDLE_ID);
    assert.equal(secret.payload.aud, "https://appleid.apple.com");
    assert.ok(secret.payload.exp > secret.payload.iat && secret.payload.exp - secret.payload.iat <= 15_724_800);

    const account = await appleAccount(sub);
    assert.equal(account?.refreshToken, "r.stored-refresh");
    assert.equal(account?.appleClientId, BUNDLE_ID);
  });

  test("a later sign-in without a code (old build) keeps the stored refresh token", async () => {
    const sub = randomId("apple-keep");
    tokenResponse = appleTokens(sub, "r.keep-me");
    assert.equal((await signInWithApple(sub, "c.code")).status, 200);
    assert.equal((await signInWithApple(sub)).status, 200);
    assert.equal((await appleAccount(sub))?.refreshToken, "r.keep-me");
  });

  test("sign-in still succeeds when the exchange fails or the code is for another Apple ID", async () => {
    const sub = randomId("apple-fail");
    tokenResponse = () => Response.json({ error: "invalid_grant" }, { status: 400 });
    assert.equal((await signInWithApple(sub, "c.expired")).status, 200);
    assert.equal((await appleAccount(sub))?.refreshToken ?? null, null);

    tokenResponse = appleTokens(randomId("someone-else"));
    assert.equal((await signInWithApple(sub, "c.other")).status, 200);
    assert.equal((await appleAccount(sub))?.refreshToken ?? null, null);

    tokenResponse = () => {
      throw new TypeError("fetch failed");
    };
    assert.equal((await signInWithApple(sub, "c.network")).status, 200);
    assert.equal((await appleAccount(sub))?.refreshToken ?? null, null);
  });

  test("delete revokes the refresh token with the client ID it was issued to", async () => {
    const sub = randomId("apple-delete");
    tokenResponse = appleTokens(sub, "r.revoke-me");
    const { userId, cookie } = await signInWithApple(sub, "c.code");
    calls.length = 0;

    assert.equal(await deleteUser(cookie), 200);
    assert.equal(revokeCalls().length, 1);
    const { form } = revokeCalls()[0]!;
    assert.equal(form.get("client_id"), BUNDLE_ID);
    assert.equal(form.get("token"), "r.revoke-me");
    assert.equal(form.get("token_type_hint"), "refresh_token");
    const secret = decodeJwt(form.get("client_secret")!);
    assert.equal(secret.validEs256, true);
    assert.equal(secret.payload.sub, BUNDLE_ID);
    assert.equal(await userExists(userId!), false);
    assert.equal(await appleAccount(sub), null);
  });

  test("falls back to the access token when there's no refresh token", async () => {
    const sub = randomId("apple-access");
    const { cookie } = await signInWithApple(sub);
    await db.collection("account").updateOne({ providerId: "apple", accountId: sub }, { $set: { accessToken: "a.only-access" } });
    assert.equal(await deleteUser(cookie), 200);
    assert.equal(revokeCalls().length, 1);
    assert.equal(revokeCalls()[0]!.form.get("token"), "a.only-access");
    assert.equal(revokeCalls()[0]!.form.get("token_type_hint"), "access_token");
    // client_id from the stored identity token's audience
    assert.equal(revokeCalls()[0]!.form.get("client_id"), BUNDLE_ID);
  });

  test("delete still succeeds when Apple rejects the revocation or can't be reached", async () => {
    for (const fail of [
      () => Response.json({ error: "invalid_client" }, { status: 400 }),
      () => {
        throw new TypeError("fetch failed");
      },
    ]) {
      const sub = randomId("apple-revoke-fail");
      tokenResponse = appleTokens(sub);
      const { userId, cookie } = await signInWithApple(sub, "c.code");
      revokeResponse = fail;
      assert.equal(await deleteUser(cookie), 200);
      assert.equal(revokeCalls().length >= 1, true);
      assert.equal(await userExists(userId!), false);
      calls.length = 0;
    }
  });

  test("delete without a stored token makes no revoke call and succeeds", async () => {
    const sub = randomId("apple-none");
    const { userId, cookie } = await signInWithApple(sub);
    assert.equal(await deleteUser(cookie), 200);
    assert.equal(revokeCalls().length, 0);
    assert.equal(await userExists(userId!), false);
  });

  test("without the Apple key configured, sign-in and delete work and Apple isn't called", async () => {
    const sub = randomId("apple-nokey");
    tokenResponse = appleTokens(sub);
    const { userId, cookie } = await signInWithApple(sub, "c.code"); // stored while the key is set
    const saved = env.applePrivateKey;
    env.applePrivateKey = undefined;
    try {
      calls.length = 0;
      assert.equal((await signInWithApple(randomId("apple-nokey-2"), "c.code")).status, 200);
      assert.equal(tokenCalls().length, 0);
      assert.equal(await deleteUser(cookie), 200);
      assert.equal(revokeCalls().length, 0);
      assert.equal(await userExists(userId!), false);
    } finally {
      env.applePrivateKey = saved;
    }
  });
});
