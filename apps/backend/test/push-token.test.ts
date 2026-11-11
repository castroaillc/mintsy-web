// Push token validation and routing: Expo vs native APNs.
// isValidPushToken tests don't need MongoDB.
// sendPushToUser routing tests need a local replica set (docker compose up -d). Run: pnpm test
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import http2 from "node:http2";
import { after, before, describe, mock, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

useTestEnv();

const { isValidPushToken, registerPushToken, sendPushToUser } = await import("../src/push.js");
const { client, db } = await import("../src/db.js");
const { env } = await import("../src/env.js");

const pushTokens = db.collection("pushTokens");

describe("isValidPushToken", () => {
  test("accepts an Expo push token", () => {
    assert.ok(isValidPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"));
  });

  test("accepts a 64-char lowercase hex string", () => {
    assert.ok(isValidPushToken("a".repeat(64)));
    assert.ok(isValidPushToken("0123456789abcdef".repeat(4)));
  });

  test("rejects uppercase hex", () => {
    assert.ok(!isValidPushToken("A".repeat(64)));
  });

  test("rejects a hex string that is too short", () => {
    assert.ok(!isValidPushToken("a".repeat(63)));
  });

  test("rejects a hex string that is too long", () => {
    assert.ok(!isValidPushToken("a".repeat(65)));
  });

  test("rejects an empty string", () => {
    assert.ok(!isValidPushToken(""));
  });

  test("rejects an arbitrary string", () => {
    assert.ok(!isValidPushToken("not-a-push-token"));
  });
});

describe("sendPushToUser routing", () => {
  const userId = randomId("push-user");
  // A realistic-looking 64-char hex token
  const apnsToken = "b".repeat(64);

  before(async () => {
    await client.connect();
  });

  after(async () => {
    await pushTokens.deleteMany({ userId });
    await client.close();
  });

  test("APNs credentials not configured: returns device count without calling http2", async () => {
    // env already has APNS_KEY_ID="" from useTestEnv, so apnsKeyId is undefined
    await registerPushToken(userId, apnsToken, "ios");

    const connectMock = mock.method(http2, "connect");
    try {
      const count = await sendPushToUser(userId, { title: "Test", body: "Hello" });
      assert.equal(count, 1);
      assert.equal(connectMock.mock.callCount(), 0);
    } finally {
      connectMock.mock.restore();
      await pushTokens.deleteMany({ userId });
    }
  });

  test("APNs credentials configured: calls http2.connect for native tokens", async () => {
    const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

    env.apnsKeyId = "KEYID00001";
    env.apnsTeamId = "TEAM000001";
    env.apnsAuthKey = pem;
    env.apnsBundleId = "com.getmintsy.app";

    await registerPushToken(userId, apnsToken, "ios");

    // Mock http2.connect to return a session that immediately succeeds with 200
    const connectMock = mock.method(http2, "connect", () => {
      const session = new EventEmitter() as ReturnType<typeof http2.connect>;
      (session as unknown as { close: () => void }).close = () => {};
      (session as unknown as { destroy: () => void }).destroy = () => {};
      (session as unknown as { request: (h: unknown) => unknown }).request = () => {
        const req = new EventEmitter();
        setImmediate(() => {
          req.emit("response", { ":status": 200 });
          req.emit("data", Buffer.alloc(0));
          req.emit("end");
        });
        (req as unknown as { end: (d: unknown) => void }).end = () => {};
        return req;
      };
      return session;
    });

    try {
      const count = await sendPushToUser(userId, { title: "Test", body: "Hello" });
      assert.equal(count, 1);
      assert.equal(connectMock.mock.callCount(), 1);
    } finally {
      connectMock.mock.restore();
      await pushTokens.deleteMany({ userId });
      env.apnsKeyId = undefined;
      env.apnsTeamId = undefined;
      env.apnsAuthKey = undefined;
      env.apnsBundleId = undefined;
    }
  });

  test("APNs 410 response removes the stale token", async () => {
    const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

    env.apnsKeyId = "KEYID00001";
    env.apnsTeamId = "TEAM000001";
    env.apnsAuthKey = pem;
    env.apnsBundleId = "com.getmintsy.app";

    await registerPushToken(userId, apnsToken, "ios");
    assert.equal(await pushTokens.countDocuments({ token: apnsToken }), 1);

    const connectMock = mock.method(http2, "connect", () => {
      const session = new EventEmitter() as ReturnType<typeof http2.connect>;
      (session as unknown as { close: () => void }).close = () => {};
      (session as unknown as { destroy: () => void }).destroy = () => {};
      (session as unknown as { request: (h: unknown) => unknown }).request = () => {
        const req = new EventEmitter();
        setImmediate(() => {
          req.emit("response", { ":status": 410 });
          req.emit("data", Buffer.alloc(0));
          req.emit("end");
        });
        (req as unknown as { end: (d: unknown) => void }).end = () => {};
        return req;
      };
      return session;
    });

    try {
      await sendPushToUser(userId, { title: "Test", body: "Gone" });
      assert.equal(await pushTokens.countDocuments({ token: apnsToken }), 0);
    } finally {
      connectMock.mock.restore();
      await pushTokens.deleteMany({ userId });
      env.apnsKeyId = undefined;
      env.apnsTeamId = undefined;
      env.apnsAuthKey = undefined;
      env.apnsBundleId = undefined;
    }
  });
});
