// GET /version: response shape, build args, and no secrets. No MongoDB needed. Run: pnpm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, test } from "node:test";

// GIT_SHA is read once at import (like in the image), so set it first
process.env.GIT_SHA = "0123456789abcdef0123456789abcdef01234567";
process.env.BUILD_TIME = "2026-10-30T12:00:00Z";
process.env.K_REVISION = "mintsy-api-00042-abc";
process.env.BETTER_AUTH_SECRET = "must-never-appear-in-version";

const express = (await import("express")).default;
const { versionHandler } = await import("../src/version.js");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { name: string; version: string };

let server: Server;
let base: string;

async function getVersion() {
  const res = await fetch(`${base}/version`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  return { text: await res.clone().text(), body: (await res.json()) as Record<string, unknown> };
}

describe("GET /version", () => {
  before(async () => {
    const app = express();
    app.get("/version", versionHandler);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => {
    server.close();
  });

  test("returns exactly the documented fields", async () => {
    const { body } = await getVersion();
    assert.deepEqual(Object.keys(body).sort(), ["buildTime", "commit", "env", "name", "revision", "startedAt", "uptimeSeconds", "version"]);
    assert.equal(body.name, "mintsy-backend");
    assert.equal(body.version, pkg.version);
    assert.equal(body.commit, process.env.GIT_SHA);
    assert.equal(body.buildTime, "2026-10-30T12:00:00Z");
    assert.equal(body.revision, "mintsy-api-00042-abc");
    assert.equal(body.env, process.env.NODE_ENV || "development");
    assert.equal(typeof body.uptimeSeconds, "number");
    assert.ok(Number.isInteger(body.uptimeSeconds) && (body.uptimeSeconds as number) >= 0);
    const startedAt = Date.parse(body.startedAt as string);
    assert.ok(!Number.isNaN(startedAt), "startedAt is an ISO timestamp");
    assert.equal(new Date(startedAt).toISOString(), body.startedAt);
    assert.ok(startedAt <= Date.now());
  });

  test("unset or empty build values are null (local dev, empty build args)", async () => {
    process.env.BUILD_TIME = "";
    delete process.env.K_REVISION;
    try {
      const { body } = await getVersion();
      assert.equal(body.buildTime, null);
      assert.equal(body.revision, null);
    } finally {
      process.env.BUILD_TIME = "2026-10-30T12:00:00Z";
      process.env.K_REVISION = "mintsy-api-00042-abc";
    }
  });

  test("startedAt is stable across requests", async () => {
    const a = await getVersion();
    const b = await getVersion();
    assert.equal(a.body.startedAt, b.body.startedAt);
  });

  test("does not leak secrets", async () => {
    const { text } = await getVersion();
    assert.doesNotMatch(text, /must-never-appear-in-version/);
  });
});
