// ensureIndexes (src/db.ts), which the app's ensure*Indexes() use at startup. Needs a local MongoDB
// replica set (docker compose up -d). Run: pnpm test
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

useTestEnv();

const { client, db, ensureIndexes } = await import("../src/db.js");

const collection = db.collection(randomId("ensure-indexes"));
const specs = [
  { key: { userId: 1, kind: 1, id: 1 }, unique: true },
  { key: { userId: 1, updatedAt: -1 } },
  { key: { receivedAt: 1 }, expireAfterSeconds: 3600 },
];

before(() => client.connect());
after(async () => {
  await collection.drop().catch(() => {});
  await client.close();
});

test("creates every index on a collection that doesn't exist yet, named as createIndex names them", async () => {
  await ensureIndexes(collection, specs);
  const indexes = await collection.listIndexes().toArray();
  assert.deepEqual(indexes.map((i) => i.name).sort(), ["_id_", "receivedAt_1", "userId_1_kind_1_id_1", "userId_1_updatedAt_-1"]);
  assert.equal(indexes.find((i) => i.name === "userId_1_kind_1_id_1")?.unique, true);
  assert.equal(indexes.find((i) => i.name === "receivedAt_1")?.expireAfterSeconds, 3600);
});

test("when they all exist it only lists them", async () => {
  const createIndexes = collection.createIndexes.bind(collection);
  let calls = 0;
  collection.createIndexes = ((...args: Parameters<typeof createIndexes>) => {
    calls++;
    return createIndexes(...args);
  }) as typeof collection.createIndexes;
  try {
    await ensureIndexes(collection, specs);
    assert.equal(calls, 0);
  } finally {
    collection.createIndexes = createIndexes;
  }
});

test("creates only what's missing", async () => {
  await collection.dropIndex("userId_1_updatedAt_-1");
  await ensureIndexes(collection, specs);
  assert.ok((await collection.listIndexes().toArray()).some((i) => i.name === "userId_1_updatedAt_-1"));
});

test("an index whose options changed still fails, as createIndex did", async () => {
  await assert.rejects(ensureIndexes(collection, [{ key: { receivedAt: 1 }, expireAfterSeconds: 60 }]));
});
