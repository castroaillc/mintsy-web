// Watch progress: setProgress, continueWatching, progress(bookId), finishedBookIds through the GraphQL schema.
// Needs a local MongoDB replica set (docker compose up -d). Run: pnpm test
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

useTestEnv();

const { ApolloServer } = await import("@apollo/server");
const { client, db } = await import("../src/db.js");
const { typeDefs, resolvers } = await import("../src/graphql/schema.js");
const { ensureProgressIndexes, watchProgress } = await import("../src/progress.js");
const { NOT_PREMIUM } = await import("../src/entitlements.js");
type Context = import("../src/graphql/context.js").Context;

const server = new ApolloServer<Context>({ typeDefs, resolvers });

const PREMIUM = { active: true, expiresAt: null, willRenew: true, periodType: "normal", productId: "p", store: "rc_billing" };

function contextFor(userId: string | null, premium = false): Context {
  return {
    session: userId
      ? ({ user: { id: userId, name: "Test", email: `${userId}@example.com` }, session: {} } as unknown as Context["session"])
      : null,
    viewerPremium: async () => (premium && userId ? PREMIUM : NOT_PREMIUM),
    setViewerPremium: () => {},
  };
}

async function gql<T = Record<string, any>>(
  query: string,
  variables: Record<string, unknown>,
  ctx: Context,
): Promise<{ data?: T; code?: string; message?: string }> {
  const res = await server.executeOperation<T>({ query, variables }, { contextValue: ctx });
  assert.equal(res.body.kind, "single");
  const { data, errors } = (res.body as { singleResult: { data?: T; errors?: { message: string; extensions?: { code?: string } }[] } })
    .singleResult;
  // graphql-js returns null-prototype objects; make them plain for deepEqual
  return { data: data ? (JSON.parse(JSON.stringify(data)) as T) : undefined, code: errors?.[0]?.extensions?.code, message: errors?.[0]?.message };
}

const FIELDS = `id episodeId bookId episodeNumber positionSec durationSec completed updatedAt
  episode { id number locked videoUrl } book { id }`;
const SET = `mutation($id: ID!, $pos: Int!, $completed: Boolean) {
  setProgress(episodeId: $id, positionSec: $pos, completed: $completed) { ${FIELDS} } }`;
const CONTINUE = `query($limit: Int) { me { continueWatching(limit: $limit) { ${FIELDS} } } }`;

const episode = (number: number, status: "draft" | "published" = "published") => ({
  number,
  title: `Episode ${number}`,
  summary: "s",
  durationSec: 100,
  transcript: [{ startSec: 0, text: "hello" }],
  takeaways: ["t"],
  videoPath: `books/x/${number}.mp4`,
  status,
});

const bookA = randomId("progress-a");
const bookB = randomId("progress-b");
const draftBook = randomId("progress-draft");

async function set(ctx: Context, id: string, pos: number, completed?: boolean | null) {
  return gql<{ setProgress: any }>(SET, { id, pos, completed }, ctx);
}

/** Moves a progress doc into the past, so ordering and the out-of-order window are deterministic. */
async function backdate(userId: string, episodeId: string, secondsAgo: number) {
  await watchProgress.updateOne({ userId, episodeId }, { $set: { updatedAt: new Date(Date.now() - secondsAgo * 1000) } });
}

async function continueWatching(ctx: Context, limit?: number) {
  const res = await gql<{ me: { continueWatching: any[] } }>(CONTINUE, limit === undefined ? {} : { limit }, ctx);
  assert.equal(res.code, undefined, res.message);
  return res.data!.me.continueWatching;
}

describe("watch progress", () => {
  before(async () => {
    await client.connect();
    await ensureProgressIndexes();
    // 5 published episodes and a draft 6th; a second book; a draft book
    await db.collection("books").insertMany([
      { _id: bookA, title: "A", author: "x", category: "Finance", coverTone: "", tint: "", description: "", order: 9001,
        episodes: [1, 2, 3, 4, 5].map((n) => episode(n)).concat(episode(6, "draft")) },
      { _id: bookB, title: "B", author: "x", category: "Finance", coverTone: "", tint: "", description: "", order: 9002,
        episodes: [1, 2].map((n) => episode(n)) },
      { _id: draftBook, title: "D", author: "x", category: "Finance", coverTone: "", tint: "", description: "", order: 9003,
        status: "draft", episodes: [episode(1)] },
    ] as any[]);
  });
  after(async () => {
    await db.collection("books").deleteMany({ _id: { $in: [bookA, bookB, draftBook] } } as any);
    await watchProgress.deleteMany({ bookId: { $in: [bookA, bookB, draftBook] } });
    await client.close();
  });

  test("setProgress requires a session", async () => {
    assert.equal((await set(contextFor(null), `${bookA}-1`, 10)).code, "UNAUTHENTICATED");
  });

  test("setProgress stores, clamps and is idempotent", async () => {
    const ctx = contextFor(randomId("user"));
    const first = await set(ctx, `${bookA}-1`, 30);
    assert.equal(first.code, undefined, first.message);
    const p = first.data!.setProgress;
    assert.equal(p.id, `${bookA}-1`);
    assert.equal(p.episodeId, `${bookA}-1`);
    assert.equal(p.bookId, bookA);
    assert.equal(p.episodeNumber, 1);
    assert.equal(p.positionSec, 30);
    assert.equal(p.durationSec, 100);
    assert.equal(p.completed, false);
    assert.ok(!Number.isNaN(Date.parse(p.updatedAt)));
    assert.deepEqual(p.episode, { id: `${bookA}-1`, number: 1, locked: false, videoUrl: "https://storage.googleapis.com/mintsy-media/books/x/1.mp4" });
    assert.deepEqual(p.book, { id: bookA });

    const again = (await set(ctx, `${bookA}-1`, 30)).data!.setProgress;
    assert.equal(again.positionSec, 30);
    assert.equal(again.completed, false);
    assert.equal(await watchProgress.countDocuments({ userId: ctx.session!.user.id }), 1);

    assert.equal((await set(ctx, `${bookA}-2`, -20)).data!.setProgress.positionSec, 0);
    const over = (await set(ctx, `${bookA}-3`, 5000)).data!.setProgress;
    assert.equal(over.positionSec, 100);
    assert.equal(over.completed, true, "a position at the end completes the episode");
  });

  test("completed: 95% sets it, null keeps it, false clears it", async () => {
    const ctx = contextFor(randomId("user"));
    const id = `${bookA}-2`;
    assert.equal((await set(ctx, id, 94)).data!.setProgress.completed, false);
    assert.equal((await set(ctx, id, 95)).data!.setProgress.completed, true);
    await backdate(ctx.session!.user.id, id, 60);
    const rewatch = (await set(ctx, id, 10)).data!.setProgress;
    assert.equal(rewatch.positionSec, 10);
    assert.equal(rewatch.completed, true, "rewatching keeps completed");
    assert.equal((await set(ctx, id, 10, false)).data!.setProgress.completed, false);
    assert.equal((await set(ctx, id, 10, true)).data!.setProgress.completed, true);
  });

  test("a backwards save right after a newer one is ignored as out of order", async () => {
    const ctx = contextFor(randomId("user"));
    const id = `${bookA}-1`;
    await set(ctx, id, 50);
    const stale = (await set(ctx, id, 40)).data!.setProgress;
    assert.equal(stale.positionSec, 50, "the newer position is kept");
    // Forwards always applies
    assert.equal((await set(ctx, id, 60)).data!.setProgress.positionSec, 60);
    // Backwards after the window applies (a real seek back): last write wins
    await backdate(ctx.session!.user.id, id, 5);
    assert.equal((await set(ctx, id, 20)).data!.setProgress.positionSec, 20);
  });

  test("setProgress rejects unknown, draft and malformed ids", async () => {
    const ctx = contextFor(randomId("user"));
    for (const id of [`${bookA}-6`, `${bookA}-99`, `${bookA}-0`, `${draftBook}-1`, "no-such-book-1", "garbage", ""]) {
      const res = await set(ctx, id, 10);
      assert.equal(res.code, "BAD_USER_INPUT", id);
      assert.equal(res.message, "Unknown episode");
    }
    assert.equal(await watchProgress.countDocuments({ userId: ctx.session!.user.id }), 0);
  });

  test("setProgress rejects locked episodes for free viewers", async () => {
    const userId = randomId("user");
    const res = await set(contextFor(userId), `${bookA}-4`, 10);
    assert.equal(res.code, "FORBIDDEN");
    assert.equal(res.message, "Premium required");
    const premium = await set(contextFor(userId, true), `${bookA}-4`, 10);
    assert.equal(premium.code, undefined, premium.message);
    assert.equal(premium.data!.setProgress.episode.locked, false);
  });

  test("continueWatching: unfinished episode, then the next one after a finish", async () => {
    const ctx = contextFor(randomId("user"));
    assert.deepEqual(await continueWatching(ctx), []);

    await set(ctx, `${bookA}-1`, 40);
    let list = await continueWatching(ctx);
    assert.equal(list.length, 1);
    assert.equal(list[0].episodeId, `${bookA}-1`);
    assert.equal(list[0].positionSec, 40);

    await set(ctx, `${bookA}-1`, 100);
    list = await continueWatching(ctx);
    assert.equal(list.length, 1);
    assert.equal(list[0].episodeId, `${bookA}-2`, "the next episode after the finished one");
    assert.equal(list[0].positionSec, 0);
    assert.equal(list[0].completed, false);
    assert.equal(list[0].durationSec, 100);
    assert.equal(list[0].episode.id, `${bookA}-2`);
  });

  test("continueWatching: the next episode after the free ones is returned locked", async () => {
    const ctx = contextFor(randomId("user"));
    await set(ctx, `${bookA}-3`, 100, true);
    const [entry] = await continueWatching(ctx);
    assert.equal(entry.episodeId, `${bookA}-4`);
    assert.equal(entry.positionSec, 0);
    assert.equal(entry.episode.locked, true);
    assert.equal(entry.episode.videoUrl, null);
  });

  test("continueWatching: one per book, newest first; finished series are skipped; limit", async () => {
    const userId = randomId("user");
    const ctx = contextFor(userId, true);
    // Book B: episode 1 in progress, older
    await set(ctx, `${bookB}-1`, 30);
    await backdate(userId, `${bookB}-1`, 600);
    // Book A: 1 and 2 touched, 2 most recently
    await set(ctx, `${bookA}-1`, 100);
    await backdate(userId, `${bookA}-1`, 300);
    await set(ctx, `${bookA}-2`, 70);

    let list = await continueWatching(ctx);
    assert.deepEqual(list.map((p) => p.episodeId), [`${bookA}-2`, `${bookB}-1`]);
    assert.deepEqual((await continueWatching(ctx, 1)).map((p) => p.episodeId), [`${bookA}-2`]);
    assert.deepEqual(await continueWatching(ctx, 0), []);
    assert.equal((await gql(CONTINUE, { limit: 51 }, ctx)).code, "BAD_USER_INPUT");

    // Finish all of book B: it leaves continueWatching and shows up in finishedBookIds
    await set(ctx, `${bookB}-1`, 100);
    await set(ctx, `${bookB}-2`, 100);
    list = await continueWatching(ctx);
    assert.deepEqual(list.map((p) => p.episodeId), [`${bookA}-2`]);
    const finished = await gql<{ me: { finishedBookIds: string[] } }>("{ me { finishedBookIds } }", {}, ctx);
    assert.deepEqual(finished.data!.me.finishedBookIds, [bookB]);

    // Skipped episodes: finishing A-5 last points back at the first unfinished one (A-2 is partly watched)
    for (const n of [3, 4, 5]) await set(ctx, `${bookA}-${n}`, 100);
    list = await continueWatching(ctx);
    assert.equal(list[0].episodeId, `${bookA}-2`);
    assert.equal(list[0].positionSec, 70);
  });

  test("progress(bookId) lists every episode with progress", async () => {
    const ctx = contextFor(randomId("user"));
    await set(ctx, `${bookA}-2`, 20);
    await set(ctx, `${bookA}-1`, 100);
    const res = await gql<{ me: { progress: any[] } }>(
      "query($b: ID!) { me { progress(bookId: $b) { episodeNumber positionSec completed } } }",
      { b: bookA },
      ctx,
    );
    assert.deepEqual(res.data!.me.progress, [
      { episodeNumber: 1, positionSec: 100, completed: true },
      { episodeNumber: 2, positionSec: 20, completed: false },
    ]);
    const none = await gql<{ me: { progress: any[] } }>("query($b: ID!) { me { progress(bookId: $b) { id } } }", { b: bookB }, ctx);
    assert.deepEqual(none.data!.me.progress, []);
  });

  test("an unpublished episode returns episode: null", async () => {
    const userId = randomId("user");
    const ctx = contextFor(userId);
    await set(ctx, `${bookB}-2`, 20);
    await db.collection("books").updateOne({ _id: bookB } as any, { $set: { "episodes.1.status": "draft" } });
    try {
      const res = await gql<{ me: { progress: any[] } }>(
        "query($b: ID!) { me { progress(bookId: $b) { episodeId durationSec episode { id } book { id } } } }",
        { b: bookB },
        ctx,
      );
      assert.deepEqual(res.data!.me.progress, [{ episodeId: `${bookB}-2`, durationSec: 100, episode: null, book: { id: bookB } }]);
      // continueWatching falls back to the first unfinished published episode
      assert.deepEqual((await continueWatching(ctx)).map((p) => p.episodeId), [`${bookB}-1`]);
    } finally {
      await db.collection("books").updateOne({ _id: bookB } as any, { $set: { "episodes.1.status": "published" } });
    }
  });
});
