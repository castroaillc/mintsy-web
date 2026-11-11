// episodeVoices through the GraphQL schema: locking, catalog visibility, URLs, legacy episodes, and
// voices staying out of catalog reads. Needs a local MongoDB replica set (docker compose up -d). Run: pnpm test
import assert from "node:assert/strict";
import { after, before, describe, mock, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

const BASE = "https://media.example.test";
useTestEnv({ MEDIA_BASE_URL: BASE });

const { ApolloServer } = await import("@apollo/server");
const { Storage } = await import("@google-cloud/storage");
const { client } = await import("../src/db.js");
const { books, catalogProjection, getPublishedBook, listPublishedBooks } = await import("../src/catalog.js");
const { env } = await import("../src/env.js");
const { continueWatching, setProgress, watchProgress } = await import("../src/progress.js");
const { typeDefs, resolvers } = await import("../src/graphql/schema.js");
const { NOT_PREMIUM } = await import("../src/entitlements.js");
type Context = import("../src/graphql/context.js").Context;
type EpisodeDoc = import("../src/catalog.js").EpisodeDoc;
type EpisodeVoiceDoc = import("../src/catalog.js").EpisodeVoiceDoc;
type BookDoc = import("../src/catalog.js").BookDoc;

const server = new ApolloServer<Context>({ typeDefs, resolvers });

const PREMIUM = { active: true, expiresAt: null, willRenew: true, periodType: "normal", productId: "p", store: "rc_billing" };
const session = { user: { id: "voices-viewer", name: "Test", email: "voices-viewer@example.com" }, session: {} } as unknown as Context["session"];

const context = (signedIn: boolean, premium: boolean): Context => ({
  session: signedIn ? session : null,
  viewerPremium: async () => (premium ? PREMIUM : NOT_PREMIUM),
  setViewerPremium: () => {},
});
const SIGNED_OUT = context(false, false);
const FREE_VIEWER = context(true, false);
const PREMIUM_VIEWER = context(true, true);

type VoiceView = {
  id: string;
  name: string;
  isDefault: boolean;
  videoUrl: string | null;
  hlsUrl: string | null;
  durationSec: number;
  transcript: { startSec: number; text: string }[];
  captions: { startSec: number; endSec: number; text: string }[];
};

async function run<T>(query: string, variables: Record<string, unknown>, ctx: Context) {
  const res = await server.executeOperation<T>({ query, variables }, { contextValue: ctx });
  assert.equal(res.body.kind, "single");
  const { data, errors } = (res.body as { singleResult: { data?: T; errors?: { message: string }[] } }).singleResult;
  return { data: data ? (JSON.parse(JSON.stringify(data)) as T) : undefined, errors };
}

async function gql<T>(query: string, variables: Record<string, unknown>, ctx: Context): Promise<T> {
  const { data, errors } = await run<T>(query, variables, ctx);
  assert.equal(errors, undefined);
  return data!;
}

async function voices(episodeId: string, ctx: Context) {
  const { episodeVoices } = await gql<{ episodeVoices: VoiceView[] }>(
    `query($id: ID!) {
      episodeVoices(episodeId: $id) {
        id name isDefault videoUrl hlsUrl durationSec
        transcript { startSec text }
        captions { startSec endSec text }
      }
    }`,
    { id: episodeId },
    ctx,
  );
  return episodeVoices;
}

const bookId = randomId("voices");
const gapBookId = randomId("voices-gap");
const draftBookId = randomId("voices-draft");
const voiceMarker = `voicemarker${bookId.replace(/\W/g, "")}`;

const videoPathOf = (book: string, number: number) => `books/${book}/${number}-abc.mp4`;

const voicePair = (book: string, number: number): EpisodeVoiceDoc[] => [
  {
    id: "af_heart",
    name: "Heart",
    isDefault: true,
    videoPath: videoPathOf(book, number), // the default voice is the episode's own render
    hlsPath: `books/${book}/${number}-abc/master.m3u8`,
    durationSec: 100,
    transcript: [{ startSec: 0, text: `${voiceMarker} heart` }],
    captions: [{ startSec: 0.25, endSec: 1.75, text: `${voiceMarker} heart` }],
  },
  {
    id: "am_adam",
    name: "Adam",
    isDefault: false,
    videoPath: `books/${book}/${number}-am_adam.mp4`, // MP4 only
    durationSec: 110,
    transcript: [{ startSec: 0, text: `${voiceMarker} adam` }],
    captions: [{ startSec: 0.5, endSec: 2.5, text: `${voiceMarker} adam` }],
  },
];

const episode = (book: string, number: number, extra: Partial<EpisodeDoc> = {}): EpisodeDoc => ({
  number,
  title: `Episode ${number}`,
  summary: "s",
  durationSec: 100,
  transcript: [{ startSec: 0, text: "hello" }],
  takeaways: ["t"],
  videoPath: videoPathOf(book, number),
  hlsPath: `books/${book}/${number}-abc/master.m3u8`,
  status: "published",
  ...extra,
});

const bookDoc = (id: string, episodes: EpisodeDoc[], status: "draft" | "published" = "published"): BookDoc => ({
  _id: id,
  title: `Voices book ${id}`,
  author: "a",
  category: "Finance",
  coverTone: "c",
  tint: "t",
  description: "d",
  order: 9999,
  status,
  episodes,
});

/** What a media URL looks like once the signing library has run, without touching Google Cloud. */
const signedUrlOf = (path: string) => `https://signed.example.test/${path}?sig=1`;

describe("episodeVoices", () => {
  before(async () => {
    await client.connect();
    await server.start();
    await books.insertMany([
      bookDoc(bookId, [
        episode(bookId, 1, { voices: voicePair(bookId, 1) }),
        episode(bookId, 2), // legacy: no voices field
        episode(bookId, 3, { voices: [] }),
        episode(bookId, 4, { voices: voicePair(bookId, 4) }), // past the free tier
      ]),
      // Within the free tier, so only visibility can hide these
      bookDoc(gapBookId, [
        episode(gapBookId, 1, { voices: voicePair(gapBookId, 1) }),
        episode(gapBookId, 2, { status: "draft", voices: voicePair(gapBookId, 2) }),
        episode(gapBookId, 3, { voices: voicePair(gapBookId, 3) }), // published, but after the draft
      ]),
      bookDoc(draftBookId, [episode(draftBookId, 1, { voices: voicePair(draftBookId, 1) })], "draft"),
    ]);
  });

  after(async () => {
    await books.deleteMany({ _id: { $in: [bookId, gapBookId, draftBookId] } });
    await watchProgress.deleteMany({ userId: session!.user.id });
    await server.stop();
    await client.close();
  });

  describe("locked episodes", () => {
    test("signed out gets nothing", async () => {
      assert.deepEqual(await voices(`${bookId}-4`, SIGNED_OUT), []);
    });

    test("signed in without Premium gets nothing", async () => {
      assert.deepEqual(await voices(`${bookId}-4`, FREE_VIEWER), []);
    });

    test("Premium gets the voices, and the same episode reports unlocked", async () => {
      const result = await voices(`${bookId}-4`, PREMIUM_VIEWER);
      assert.deepEqual(result.map((v) => v.id), ["af_heart", "am_adam"]);
      assert.equal(result[0]!.videoUrl, `${BASE}/${videoPathOf(bookId, 4)}`);
      assert.equal(result[0]!.captions.length, 1);

      const { book } = await gql<{ book: { episodes: { number: number; locked: boolean }[] } }>(
        `query($id: ID!) { book(id: $id) { episodes { number locked } } }`,
        { id: bookId },
        PREMIUM_VIEWER,
      );
      assert.equal(book.episodes.find((e) => e.number === 4)!.locked, false);
    });
  });

  describe("free episodes", () => {
    test("every field comes through, for signed-out and signed-in viewers", async () => {
      for (const ctx of [SIGNED_OUT, FREE_VIEWER]) {
        assert.deepEqual(await voices(`${bookId}-1`, ctx), [
          {
            id: "af_heart",
            name: "Heart",
            isDefault: true,
            videoUrl: `${BASE}/${videoPathOf(bookId, 1)}`,
            hlsUrl: `${BASE}/books/${bookId}/1-abc/master.m3u8`,
            durationSec: 100,
            transcript: [{ startSec: 0, text: `${voiceMarker} heart` }],
            captions: [{ startSec: 0.25, endSec: 1.75, text: `${voiceMarker} heart` }],
          },
          {
            id: "am_adam",
            name: "Adam",
            isDefault: false,
            videoUrl: `${BASE}/books/${bookId}/1-am_adam.mp4`,
            hlsUrl: null,
            durationSec: 110,
            transcript: [{ startSec: 0, text: `${voiceMarker} adam` }],
            captions: [{ startSec: 0.5, endSec: 2.5, text: `${voiceMarker} adam` }],
          },
        ]);
      }
    });

    /** Episode 1's URLs next to its default voice's, which share their paths. */
    async function episodeAndDefaultVoice() {
      const { book } = await gql<{ book: { episodes: { videoUrl: string | null; hlsUrl: string | null }[] } }>(
        `query($id: ID!) { book(id: $id) { episodes { videoUrl hlsUrl } } }`,
        { id: bookId },
        SIGNED_OUT,
      );
      return { fromEpisode: book.episodes[0]!, all: await voices(`${bookId}-1`, SIGNED_OUT) };
    }

    test("public URLs match Episode.videoUrl and hlsUrl", async () => {
      const { fromEpisode, all } = await episodeAndDefaultVoice();
      assert.equal(all[0]!.videoUrl, fromEpisode.videoUrl);
      assert.equal(all[0]!.hlsUrl, fromEpisode.hlsUrl);
    });

    test("SIGNED_MEDIA on: videoUrl is signed like Episode.videoUrl, and hlsUrl is null", async (t) => {
      const signedPaths: string[] = [];
      t.mock.method(Storage.prototype, "bucket", (() => ({
        file: (path: string) => ({
          getSignedUrl: async () => {
            signedPaths.push(path);
            return [signedUrlOf(path)];
          },
        }),
      })) as never);
      env.signedMedia = true;
      try {
        const { fromEpisode, all } = await episodeAndDefaultVoice();
        assert.equal(all[0]!.videoUrl, signedUrlOf(videoPathOf(bookId, 1)));
        assert.equal(all[1]!.videoUrl, signedUrlOf(`books/${bookId}/1-am_adam.mp4`));
        assert.equal(all[0]!.videoUrl, fromEpisode.videoUrl);
        assert.deepEqual(all.map((v) => v.hlsUrl), [null, null]);
        assert.equal(fromEpisode.hlsUrl, null);
        // No playlist was signed
        assert.ok(signedPaths.length > 0);
        assert.ok(signedPaths.every((p) => p.endsWith(".mp4")));
      } finally {
        env.signedMedia = false;
      }
    });
  });

  describe("legacy episodes", () => {
    test("missing voices returns []", async () => {
      assert.deepEqual(await voices(`${bookId}-2`, PREMIUM_VIEWER), []);
    });

    test("empty voices returns []", async () => {
      assert.deepEqual(await voices(`${bookId}-3`, PREMIUM_VIEWER), []);
    });
  });

  describe("catalog visibility", () => {
    for (const [label, ctx] of [["signed out", SIGNED_OUT], ["Premium", PREMIUM_VIEWER]] as const) {
      test(`${label}: a draft episode returns []`, async () => {
        assert.deepEqual(await voices(`${gapBookId}-2`, ctx), []);
      });

      test(`${label}: a published episode past the contiguous run returns []`, async () => {
        assert.deepEqual(await voices(`${gapBookId}-3`, ctx), []);
      });

      test(`${label}: an episode of a draft book returns []`, async () => {
        assert.deepEqual(await voices(`${draftBookId}-1`, ctx), []);
      });

      test(`${label}: unknown and malformed ids return []`, async () => {
        for (const id of [`${randomId("no-such-book")}-1`, `${bookId}-99`, `${bookId}-0`, bookId, "", "-1"]) {
          assert.deepEqual(await voices(id, ctx), [], id);
        }
      });
    }

    test("the episode before the gap still returns its voices", async () => {
      assert.equal((await voices(`${gapBookId}-1`, SIGNED_OUT)).length, 2);
    });
  });

  describe("catalog reads", () => {
    const hasNoVoices = (book: BookDoc | null | undefined) => {
      assert.ok(book);
      assert.ok(book.episodes.length > 0);
      for (const e of book.episodes) assert.equal("voices" in e, false, `episode ${e.number}`);
    };

    test("the test book really has voices stored", async () => {
      const raw = await books.findOne({ _id: bookId });
      assert.equal(raw?.episodes[0]?.voices?.length, 2);
    });

    test("catalogProjection drops voices in MongoDB and keeps everything else", async () => {
      const projected = await books.findOne({ _id: bookId }, { projection: catalogProjection });
      hasNoVoices(projected);
      const first = projected!.episodes[0]!;
      assert.equal(first.hlsPath, `books/${bookId}/1-abc/master.m3u8`);
      assert.equal(first.videoPath, videoPathOf(bookId, 1));
      assert.equal(first.transcript.length, 1);
      assert.equal(projected!.episodes[3]!.number, 4);
    });

    /** Runs fn and checks that no catalog query it makes asks MongoDB for voices. */
    async function withoutVoiceReads(fn: () => Promise<void>) {
      const find = mock.method(books, "find");
      const findOne = mock.method(books, "findOne");
      const aggregate = mock.method(books, "aggregate");
      try {
        await fn();
        assert.ok(find.mock.callCount() > 0);
        for (const call of [...find.mock.calls, ...findOne.mock.calls]) {
          const projection = ((call.arguments as unknown[])[1] as { projection?: Record<string, unknown> })?.projection;
          assert.equal(projection?.["episodes.voices"], catalogProjection["episodes.voices"]);
        }
        for (const call of aggregate.mock.calls) {
          // A field path (episodes.voices, $$e.voices) or a voices key; book ids may contain "voices-"
          assert.doesNotMatch(JSON.stringify((call.arguments as unknown[])[0]), /\.voices\b|"voices"/);
        }
      } finally {
        find.mock.restore();
        findOne.mock.restore();
        aggregate.mock.restore();
      }
    }

    test("listPublishedBooks and getPublishedBook ask MongoDB to leave voices out", async () => {
      await withoutVoiceReads(async () => {
        hasNoVoices((await listPublishedBooks()).find((b) => b._id === bookId));
        hasNoVoices(await getPublishedBook(bookId));
      });
    });

    test("watch progress asks MongoDB to leave voices out", async () => {
      await withoutVoiceReads(async () => {
        await setProgress(session!.user.id, `${bookId}-1`, 10, null, () => false);
      });
    });

    test("episodeVoices fetches only the episode asked for", async () => {
      const aggregate = mock.method(books, "aggregate");
      let pipeline: object[];
      try {
        assert.equal((await voices(`${bookId}-4`, PREMIUM_VIEWER)).length, 2);
        assert.equal(aggregate.mock.callCount(), 1);
        pipeline = (aggregate.mock.calls[0]!.arguments as unknown[])[0] as object[];
      } finally {
        aggregate.mock.restore();
      }
      // What that query returns: every episode's number and status, and voices for episode 4 only
      const [returned] = await books.aggregate<BookDoc>(pipeline).toArray();
      assert.deepEqual(returned!.episodes.map((e) => e.number), [1, 2, 3, 4]);
      assert.deepEqual(returned!.episodes.filter((e) => "voices" in e).map((e) => e.number), [4]);
      assert.deepEqual(returned!.episodes.map((e) => e.status), ["published", "published", "published", "published"]);
    });

    test("watch progress never hands voices on, for writes or reads", async () => {
      const userId = session!.user.id;
      const written = await setProgress(userId, `${bookId}-1`, 10, null, () => false);
      assert.ok(typeof written === "object");
      hasNoVoices(written.book);
      assert.equal("voices" in written.episode!, false);

      const entry = (await continueWatching(userId, 50)).find((p) => p.bookId === bookId);
      hasNoVoices(entry?.book);
      assert.equal("voices" in entry!.episode!, false);
    });

    test("the Episode type has no voices field", async () => {
      const { errors } = await run(`query($id: ID!) { book(id: $id) { episodes { voices { id } } } }`, { id: bookId }, PREMIUM_VIEWER);
      assert.match(errors?.[0]?.message ?? "", /Cannot query field "voices" on type "Episode"/);
    });

    test("search doesn't look inside voices", async () => {
      const { search } = await gql<{ search: { episodes: unknown[] } }>(
        `query($q: String!) { search(query: $q) { episodes { id } } }`,
        { q: voiceMarker },
        PREMIUM_VIEWER,
      );
      assert.deepEqual(search.episodes, []);
    });

    test("Episode fields stay the episode's own", async () => {
      const { book } = await gql<{ book: { episodes: { videoUrl: string | null; durationSec: number; transcript: { text: string }[] }[] } }>(
        `query($id: ID!) { book(id: $id) { episodes { videoUrl durationSec transcript { text } } } }`,
        { id: bookId },
        SIGNED_OUT,
      );
      assert.equal(book.episodes[0]!.videoUrl, `${BASE}/${videoPathOf(bookId, 1)}`);
      assert.equal(book.episodes[0]!.durationSec, 100);
      assert.deepEqual(book.episodes[0]!.transcript, [{ text: "hello" }]);
    });
  });
});
