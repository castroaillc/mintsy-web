// The published catalog read path with the in-process cache on (CATALOG_CACHE_SECONDS=60): the parallel
// transcript load, staleness bounds, failed loads, and the per-episode voices cache. Needs a local
// MongoDB replica set (docker compose up -d). Run: pnpm test
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

useTestEnv({ CATALOG_CACHE_SECONDS: "60", MONGODB_CATALOG_DB: randomId("mintsy-test-cache") });

const { catalogDb, client } = await import("../src/db.js");
const catalog = await import("../src/catalog.js");
const { books, clearCatalogCache, getPublishedBook, getPublishedBooks, getPublishedEpisodeVoices, listPublishedBooks, publicBook } =
  catalog;
type BookDoc = import("../src/catalog.js").BookDoc;
type EpisodeDoc = import("../src/catalog.js").EpisodeDoc;

const MAX_AGE_MS = 60_000;

const lines = (book: string, n: number) => [
  { startSec: 0, text: `${book} episode ${n} first` },
  { startSec: 5, text: `${book} episode ${n} second` },
];

const episode = (book: string, number: number, extra: Partial<EpisodeDoc> = {}): EpisodeDoc => ({
  number,
  title: `Episode ${number}`,
  summary: "s",
  durationSec: 100,
  transcript: lines(book, number),
  takeaways: [`takeaway ${number}`],
  videoPath: `books/${book}/${number}.mp4`,
  status: "published",
  voices: [
    {
      id: "af_heart",
      name: "Heart",
      isDefault: true,
      videoPath: `books/${book}/${number}.mp4`,
      durationSec: 100,
      transcript: [{ startSec: 0, text: `voice ${number}` }],
      captions: [{ startSec: 0, endSec: 1, text: `voice ${number}` }],
    },
  ],
  ...extra,
});

const bookDoc = (id: string, order: number, episodes: EpisodeDoc[], status: "draft" | "published" = "published"): BookDoc => ({
  _id: id,
  title: id,
  author: "a",
  category: "Finance",
  coverTone: "c",
  tint: "t",
  description: "d",
  order,
  status,
  episodes,
});

const longId = randomId("long");
const shortId = randomId("short");
const draftId = randomId("draft");
const emptyId = randomId("empty");

/** What the API served before the cache: one find per read, public filtering, voices removed. */
async function uncached(): Promise<BookDoc[]> {
  const docs = await books.find({ status: { $ne: "draft" } }).sort({ order: 1 }).toArray();
  return docs.map(publicBook).filter((b): b is BookDoc => b !== null);
}

describe("catalog cache", () => {
  before(async () => {
    await client.connect();
    // Episodes stored out of order, more of them than one transcript query takes, one without a
    // transcript, and a draft that cuts the published run at 10
    const long = [9, 3, 1, 2, 8, 4, 5, 6, 7, 10, 12, 11].map((n) =>
      n === 6 ? episode(longId, n, { transcript: undefined as never }) : n === 11 ? episode(longId, n, { status: "draft" }) : episode(longId, n),
    );
    await books.insertMany([
      bookDoc(longId, 1, long),
      bookDoc(shortId, 0, [episode(shortId, 1)]),
      bookDoc(draftId, 2, [episode(draftId, 1)], "draft"),
      bookDoc(emptyId, 3, []),
    ]);
  });

  beforeEach(() => {
    clearCatalogCache();
    mock.timers.reset();
  });

  after(async () => {
    mock.timers.reset();
    await catalogDb.dropDatabase();
    await client.close();
  });

  test("serves the same catalog as a plain read, with each transcript on its own episode", async () => {
    const aggregate = mock.method(books, "aggregate");
    let served: BookDoc[];
    try {
      served = await listPublishedBooks();
      // 12 stored episodes in queries of 2: 6 transcript queries alongside the list
      assert.equal(aggregate.mock.callCount(), 6);
    } finally {
      aggregate.mock.restore();
    }
    const expected = (await uncached()).map((b) => ({
      ...b,
      episodes: b.episodes.map((e) => ({ ...e, transcript: e.transcript ?? [] })),
    }));
    assert.deepEqual(served, expected);
    assert.deepEqual(served.map((b) => b._id), [shortId, longId]);

    const long = served.find((b) => b._id === longId)!;
    assert.deepEqual(long.episodes.map((e) => e.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const e of long.episodes) {
      assert.deepEqual(e.transcript, e.number === 6 ? [] : lines(longId, e.number), `episode ${e.number}`);
      assert.equal("voices" in e, false);
    }
  });

  test("book and getPublishedBooks come from the same load", async () => {
    const find = mock.method(books, "find");
    try {
      await listPublishedBooks();
      assert.equal((await getPublishedBook(shortId))?._id, shortId);
      assert.equal(await getPublishedBook(draftId), null);
      assert.equal(await getPublishedBook(emptyId), null);
      assert.deepEqual([...(await getPublishedBooks([longId, draftId, "nope"])).keys()], [longId]);
      assert.equal(find.mock.callCount(), 1);
    } finally {
      find.mock.restore();
    }
  });

  test("concurrent first reads share one load", async () => {
    const find = mock.method(books, "find");
    try {
      await Promise.all([listPublishedBooks(), getPublishedBook(longId), listPublishedBooks()]);
      assert.equal(find.mock.callCount(), 1);
    } finally {
      find.mock.restore();
    }
  });

  test("a change shows within the max age: cached, then refreshed in the background, then awaited", async () => {
    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    const addedId = randomId("added");
    try {
      await listPublishedBooks();
      await books.insertOne(bookDoc(addedId, 4, [episode(addedId, 1)]));
      const has = async () => (await listPublishedBooks()).some((b) => b._id === addedId);

      // Fresh: served from memory
      mock.timers.tick(MAX_AGE_MS / 4 - 1);
      assert.equal(await has(), false);

      // Past a quarter: this read still gets the cached copy and starts a refresh; later reads see it
      mock.timers.tick(2);
      assert.equal(await has(), false);
      let seen = false;
      // Only Date is mocked, so setTimeout waits for real while the refresh runs
      for (let i = 0; i < 200 && !seen; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        seen = await has();
      }
      assert.equal(seen, true);

      // Past the max age a read waits for a fresh load rather than serving the old copy
      await books.deleteOne({ _id: addedId });
      mock.timers.tick(MAX_AGE_MS);
      assert.equal(await has(), false);
    } finally {
      await books.deleteOne({ _id: addedId });
    }
  });

  test("a failed load isn't kept: the next read tries again", async () => {
    const find = mock.method(books, "find", () => {
      throw new Error("boom");
    });
    try {
      await assert.rejects(listPublishedBooks(), /boom/);
    } finally {
      find.mock.restore();
    }
    assert.ok((await listPublishedBooks()).length >= 2);
  });

  test("episode voices: only the one episode is read, it's cached, and hidden episodes never reach MongoDB", async () => {
    await listPublishedBooks();
    const aggregate = mock.method(books, "aggregate");
    try {
      const first = await getPublishedEpisodeVoices(longId, 3);
      assert.deepEqual(first.map((v) => v.transcript[0]!.text), ["voice 3"]);
      assert.deepEqual(await getPublishedEpisodeVoices(longId, 3), first);
      assert.equal(aggregate.mock.callCount(), 1);

      // Past the published run, a draft episode, a draft book, unknown ids: answered from the catalog
      for (const [id, n] of [[longId, 12], [longId, 11], [draftId, 1], ["nope", 1], [longId, 99]] as const) {
        assert.deepEqual(await getPublishedEpisodeVoices(id, n), [], `${id} ${n}`);
      }
      assert.equal(aggregate.mock.callCount(), 1);
    } finally {
      aggregate.mock.restore();
    }
  });
});
