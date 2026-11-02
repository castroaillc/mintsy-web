// MONGODB_CATALOG_DB unset (or empty): the catalog is in the app database, as on the old flat `mintsy`
// database. Needs a local MongoDB replica set.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

useTestEnv();

const { catalogDb, client, db } = await import("../src/db.js");
const { books, getPublishedBook } = await import("../src/catalog.js");

const id = randomId("fallback-book");

before(() => client.connect());
after(async () => {
  await db.collection("books").deleteOne({ _id: id } as never);
  await client.close();
});

test("the catalog handle is the app database", () => {
  assert.equal(catalogDb.databaseName, db.databaseName);
  assert.equal(books.dbName, db.databaseName);
});

test("a book written to the app database is served", async () => {
  await db.collection("books").insertOne({
    _id: id,
    title: "t",
    author: "a",
    category: "Finance",
    coverTone: "#000",
    tint: "#000",
    description: "d",
    order: 0,
    episodes: [{ number: 1, title: "e", summary: "s", durationSec: 1, transcript: [], takeaways: [] }],
  } as never);
  assert.equal((await getPublishedBook(id))?._id, id);
});
