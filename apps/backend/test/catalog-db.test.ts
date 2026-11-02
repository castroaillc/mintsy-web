// The catalog in its own database (MONGODB_CATALOG_DB): the API reads books from there, keeps user data in
// the app database, and never writes to the catalog database. Needs a local MongoDB replica set.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

const catalogDbName = randomId("mintsy-test-catalog");
useTestEnv({ MONGODB_CATALOG_DB: catalogDbName });

const { ApolloServer } = await import("@apollo/server");
const { catalogDb, client, db } = await import("../src/db.js");
const catalog = await import("../src/catalog.js");
const { savedItems, ensureSavedIndexes } = await import("../src/saved.js");
const { watchProgress, ensureProgressIndexes } = await import("../src/progress.js");
const { typeDefs, resolvers } = await import("../src/graphql/schema.js");
const { NOT_PREMIUM } = await import("../src/entitlements.js");
type Context = import("../src/graphql/context.js").Context;

const server = new ApolloServer<Context>({ typeDefs, resolvers });
const userId = randomId("catalog-db-user");
const context = {
  session: { user: { id: userId, name: "T", email: `${userId}@example.com` }, session: {} },
  viewerPremium: async () => NOT_PREMIUM,
  setViewerPremium: () => {},
} as unknown as Context;

async function gql<T>(query: string): Promise<T> {
  const res = await server.executeOperation<T>({ query }, { contextValue: context });
  assert.equal(res.body.kind, "single");
  const { data, errors } = (res.body as { singleResult: { data?: T; errors?: unknown[] } }).singleResult;
  assert.equal(errors, undefined);
  return JSON.parse(JSON.stringify(data)) as T;
}

const book = (id: string) => ({
  _id: id,
  title: id,
  author: "a",
  category: "Finance",
  coverTone: "#000",
  tint: "#000",
  description: "d",
  order: 0,
  episodes: [{ number: 1, title: "e", summary: "s", durationSec: 100, transcript: [], takeaways: [] }],
});

const inCatalogDb = randomId("in-catalog-db");
const inAppDb = randomId("in-app-db");

/** Runs the real server (src/index.ts) until /health answers. */
async function startRealServer() {
  const port = 41000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    env: { ...process.env, PORT: String(port), DOTENV_CONFIG_PATH: "/dev/null" },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    const ok = await fetch(`http://localhost:${port}/health`).then((r) => r.ok, () => false);
    if (ok) return child;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error("server did not start");
}

describe("catalog in a separate database", () => {
  before(async () => {
    await client.connect();
    assert.notEqual(db.databaseName, catalogDb.databaseName);
  });

  after(async () => {
    await savedItems.deleteMany({ userId });
    await watchProgress.deleteMany({ userId });
    await db.collection("books").deleteOne({ _id: inAppDb } as never);
    await catalogDb.dropDatabase();
    await client.close();
    await server.stop();
  });

  test("a full server start and the app's index setup create nothing in the catalog database", async () => {
    const child = await startRealServer();
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    assert.deepEqual(await catalogDb.listCollections().toArray(), []);
    assert.equal("ensureCatalogIndexes" in catalog, false);
    assert.equal("studioJobs" in catalog, false);
  });

  test("books come from the catalog database, not the app database", async () => {
    await catalogDb.collection("books").insertOne(book(inCatalogDb) as never);
    await db.collection("books").insertOne(book(inAppDb) as never);

    const { books } = await gql<{ books: { id: string }[] }>("{ books { id } }");
    const ids = books.map((b) => b.id);
    assert.ok(ids.includes(inCatalogDb));
    assert.ok(!ids.includes(inAppDb));

    const one = await gql<{ a: { id: string } | null; b: { id: string } | null }>(
      `{ a: book(id: "${inCatalogDb}") { id } b: book(id: "${inAppDb}") { id } }`,
    );
    assert.equal(one.a?.id, inCatalogDb);
    assert.equal(one.b, null);
  });

  test("My List and watch progress check the catalog database and write to the app database", async () => {
    await ensureSavedIndexes();
    await ensureProgressIndexes();
    const before = await catalogDb.listCollections().toArray();

    await gql(`mutation { setSaved(kind: BOOK, id: "${inCatalogDb}", saved: true) { id } }`);
    await gql(`mutation { setProgress(episodeId: "${inCatalogDb}-1", positionSec: 10) { positionSec } }`);

    assert.equal(await db.collection("saved_items").countDocuments({ userId }), 1);
    assert.equal(await db.collection("watch_progress").countDocuments({ userId }), 1);
    assert.deepEqual((await catalogDb.listCollections().toArray()).map((c) => c.name), before.map((c) => c.name));

    const res = await server.executeOperation(
      { query: `mutation { setSaved(kind: BOOK, id: "${inAppDb}", saved: true) { id } }` },
      { contextValue: context },
    );
    assert.match(JSON.stringify(res.body), /Unknown id/);
  });
});
