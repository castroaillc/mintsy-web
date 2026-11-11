// Dry-run jobs write valid voices too, because dashboards are tested against them. Skipped unless
// STUDIO_TEST_MONGODB_URI is set (see jobs.test.ts); refuses any non-local host. Touches no files or bucket.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { ObjectId } from "mongodb";

const uri = process.env.STUDIO_TEST_MONGODB_URI;
if (uri && !["127.0.0.1", "localhost"].includes(new URL(uri).hostname)) throw new Error("STUDIO_TEST_MONGODB_URI must be a local MongoDB");

describe("dry run", { skip: uri ? false : "set STUDIO_TEST_MONGODB_URI to a local MongoDB" }, () => {
  let jobs: typeof import("../jobs");
  let voices: typeof import("../voices");
  let client: import("mongodb").MongoClient;
  let db: import("mongodb").Db;
  const BOOK = "dry-book";
  const job = (kind: string, chapter = 1) => ({ _id: new ObjectId(), kind, bookId: BOOK, chapter, status: "running", log: [], createdAt: new Date() }) as never;
  const stored = async () => (await db.collection("books").findOne({ _id: BOOK as never }))!.episodes[0];

  before(async () => {
    process.env.STUDIO_WORKER_DRY_RUN = "1";
    process.env.MEDIA_BUCKET = "gs://stub-bucket-not-real";
    delete process.env.KOKORO_VOICES;
    jobs = await import("../jobs");
    voices = await import("../voices");
    const { MongoClient } = await import("mongodb");
    client = await new MongoClient(uri!, { serverSelectionTimeoutMS: 3000 }).connect();
    db = client.db(`mintsy_studio_test_${randomUUID().slice(0, 8)}`);
    await db.collection("books").insertOne({
      _id: BOOK as never,
      title: "Dry",
      status: "published",
      episodes: [{ number: 1, title: "Live title", summary: "Live summary", takeaways: ["Live"], durationSec: 90, transcript: [{ startSec: 5, text: "A line." }, { startSec: 9, text: "Another." }], videoPath: "old.mp4", status: "published" }],
    });
  });

  after(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  test("remaster keeps the episode live and writes valid voices", async () => {
    const result = (await jobs.runJob(db, job("remaster"))) as import("../jobs").RemasterResult;
    const episode = await stored();
    assert.equal(episode.status, "published");
    assert.equal(episode.title, "Live title");
    assert.equal(episode.summary, "Live summary");
    assert.deepEqual(result.voices, ["af_heart", "am_michael", "bm_george"]);
    assert.equal(result.transcriptLinesChanged, 0);
    assert.notEqual(episode.videoPath, "old.mp4");
    voices.checkEpisodeVoices(episode);
  });

  test("remaster of a missing episode fails", async () => {
    await assert.rejects(jobs.runJob(db, job("remaster", 9)), /no episode 9/);
  });

  test("remaster with overwriteTranscript keeps the stored text in a dry run", async () => {
    const result = (await jobs.runJob(db, { ...(job("remaster") as object), overwriteTranscript: true } as never)) as import("../jobs").RemasterResult;
    assert.equal(result.transcriptLinesChanged, 0, "a dry run keeps the stored text");
  });

  test("clip returns a clips/ path, refuses above the free tier, and leaves books alone", async () => {
    const before = await db.collection("books").findOne({ _id: BOOK as never });
    const result = (await jobs.runJob(db, { ...(job("clip") as object), startScene: 2, endScene: 3 } as never)) as import("../jobs").ClipJobResult;
    assert.equal(result.videoPath, "clips/af_heart-s02-s03.mp4");
    assert.deepEqual([result.width, result.height], [1080, 1920]);
    assert.equal(result.episodePublished, true);
    await assert.rejects(jobs.runJob(db, job("clip", 4)), /free episodes/);
    assert.deepEqual(await db.collection("books").findOne({ _id: BOOK as never }), before);
  });

  test("render returns to draft, writes valid voices and has the same result shape", async () => {
    const result = await jobs.runJob(db, job("render"));
    const episode = await stored();
    assert.equal(episode.status, "draft");
    voices.checkEpisodeVoices(episode);
    assert.deepEqual(Object.keys(result).sort(), ["durationSec", "hlsPath", "thumbnailPath", "videoPath"]);
  });
});
