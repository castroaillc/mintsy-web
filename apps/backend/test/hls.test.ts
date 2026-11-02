// Episode.hlsUrl through the GraphQL schema: locked, no hlsPath, SIGNED_MEDIA on, public URL.
// Needs a local MongoDB replica set (docker compose up -d). Run: pnpm test
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

const BASE = "https://media.example.test";
useTestEnv({ MEDIA_BASE_URL: BASE });

const { ApolloServer } = await import("@apollo/server");
const { client } = await import("../src/db.js");
const { books } = await import("../src/catalog.js");
const { env } = await import("../src/env.js");
const { hlsUrl } = await import("../src/media.js");
const { typeDefs, resolvers } = await import("../src/graphql/schema.js");
const { NOT_PREMIUM } = await import("../src/entitlements.js");
type Context = import("../src/graphql/context.js").Context;
type EpisodeDoc = import("../src/catalog.js").EpisodeDoc;

const server = new ApolloServer<Context>({ typeDefs, resolvers });

const PREMIUM = { active: true, expiresAt: null, willRenew: true, periodType: "normal", productId: "p", store: "rc_billing" };

function contextFor(premium: boolean): Context {
  return {
    session: premium
      ? ({ user: { id: "hls-viewer", name: "Test", email: "hls-viewer@example.com" }, session: {} } as unknown as Context["session"])
      : null,
    viewerPremium: async () => (premium ? PREMIUM : NOT_PREMIUM),
    setViewerPremium: () => {},
  };
}

type EpisodeView = { number: number; locked: boolean; videoUrl: string | null; hlsUrl: string | null };
const EPISODE_FIELDS = "number locked videoUrl hlsUrl";

async function gql<T>(query: string, variables: Record<string, unknown>, ctx: Context): Promise<T> {
  const res = await server.executeOperation<T>({ query, variables }, { contextValue: ctx });
  assert.equal(res.body.kind, "single");
  const { data, errors } = (res.body as { singleResult: { data?: T; errors?: unknown[] } }).singleResult;
  assert.equal(errors, undefined);
  return JSON.parse(JSON.stringify(data)) as T;
}

const bookId = randomId("hls");
const marker = `hlsmarker${bookId.replace(/\W/g, "")}`;
const hlsPathOf = (number: number) => `books/${bookId}/${number}-abc/master.m3u8`;
const videoPathOf = (number: number) => `books/${bookId}/${number}-abc.mp4`;

const episode = (number: number, extra: Partial<EpisodeDoc> = {}): EpisodeDoc => ({
  number,
  title: `Episode ${number}`,
  summary: "s",
  durationSec: 100,
  transcript: [{ startSec: 0, text: marker }],
  takeaways: ["t"],
  videoPath: videoPathOf(number),
  ...extra,
});

async function episodes(premium = false) {
  const { book } = await gql<{ book: { episodes: EpisodeView[] } }>(
    `query($id: ID!) { book(id: $id) { episodes { ${EPISODE_FIELDS} } } }`,
    { id: bookId },
    contextFor(premium),
  );
  return new Map(book.episodes.map((e) => [e.number, e]));
}

describe("Episode.hlsUrl", () => {
  before(async () => {
    await client.connect();
    await server.start();
    await books.insertOne({
      _id: bookId,
      title: "HLS book",
      author: "a",
      category: "Finance",
      coverTone: "c",
      tint: "t",
      description: "d",
      order: 9999,
      status: "published",
      episodes: [
        episode(1, { hlsPath: hlsPathOf(1) }), // free, has HLS
        episode(2), // free, MP4 only (every episode that predates HLS)
        episode(3, { hlsPath: null as unknown as string }), // stored as null rather than missing
        episode(4, { hlsPath: hlsPathOf(4) }), // past the free tier, has HLS
      ],
    });
  });

  after(async () => {
    await books.deleteOne({ _id: bookId });
    await server.stop();
    await client.close();
  });

  test("rule 1: locked for this viewer is null even with an hlsPath", async () => {
    const ep4 = (await episodes(false)).get(4)!;
    assert.equal(ep4.locked, true);
    assert.equal(ep4.hlsUrl, null);
    assert.equal(ep4.videoUrl, null);
  });

  test("rule 1: the same episode has a URL once the viewer is Premium", async () => {
    const ep4 = (await episodes(true)).get(4)!;
    assert.equal(ep4.locked, false);
    assert.equal(ep4.hlsUrl, `${BASE}/${hlsPathOf(4)}`);
  });

  test("rule 2: no hlsPath is null, and the MP4 is unaffected", async () => {
    const all = await episodes(true);
    for (const n of [2, 3]) {
      assert.equal(all.get(n)!.hlsUrl, null);
      assert.equal(all.get(n)!.videoUrl, `${BASE}/${videoPathOf(n)}`);
    }
  });

  test("rule 3: SIGNED_MEDIA on is null for every viewer, without signing anything", async () => {
    env.signedMedia = true;
    try {
      // Synchronous null: no signing call is made for the playlist
      assert.equal(hlsUrl(hlsPathOf(1)), null);
      for (const premium of [false, true]) {
        const { book } = await gql<{ book: { episodes: { number: number; hlsUrl: string | null }[] } }>(
          `query($id: ID!) { book(id: $id) { episodes { number hlsUrl } } }`,
          { id: bookId },
          contextFor(premium),
        );
        assert.deepEqual(book.episodes.map((e) => e.hlsUrl), [null, null, null, null]);
      }
    } finally {
      env.signedMedia = false;
    }
  });

  test("rule 4: otherwise the public URL, next to an unchanged videoUrl", async () => {
    const ep1 = (await episodes(false)).get(1)!;
    assert.equal(ep1.locked, false);
    assert.equal(ep1.hlsUrl, `${BASE}/${hlsPathOf(1)}`);
    assert.equal(ep1.videoUrl, `${BASE}/${videoPathOf(1)}`);
  });

  test("hlsPath survives the other routes to an episode (books, search)", async () => {
    const ctx = contextFor(false);
    const { books: listed } = await gql<{ books: { id: string; episodes: EpisodeView[] }[] }>(
      `{ books { id episodes { ${EPISODE_FIELDS} } } }`,
      {},
      ctx,
    );
    assert.equal(listed.find((b) => b.id === bookId)?.episodes[0]?.hlsUrl, `${BASE}/${hlsPathOf(1)}`);

    const { search } = await gql<{ search: { episodes: { episode: EpisodeView }[] } }>(
      `query($q: String!) { search(query: $q) { episodes { episode { ${EPISODE_FIELDS} } } } }`,
      { q: marker },
      ctx,
    );
    assert.equal(search.episodes.find((m) => m.episode.number === 1)?.episode.hlsUrl, `${BASE}/${hlsPathOf(1)}`);
  });
});
