// upload and remaster against a throwaway local MongoDB, with stub `gcloud` and real Remotion and HLS
// on a tiny made-up book. Skipped unless STUDIO_TEST_MONGODB_URI is set, and refuses any non-local
// host. Never loads .env and never reaches a bucket:
//   docker run -d --rm --name studio-test-mongo -p 127.0.0.1:27099:27017 mongo:8
//   STUDIO_TEST_MONGODB_URI=mongodb://127.0.0.1:27099 pnpm test
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { ObjectId } from "mongodb";

const uri = process.env.STUDIO_TEST_MONGODB_URI;
const local = uri ? ["127.0.0.1", "localhost"].includes(new URL(uri).hostname) : false;
if (uri && !local) throw new Error("STUDIO_TEST_MONGODB_URI must be a local MongoDB");

describe("upload and remaster", { skip: uri ? false : "set STUDIO_TEST_MONGODB_URI to a local MongoDB" }, () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "mintsy-studio-test-"));
  const work = path.join(root, "work");
  const bin = path.join(root, "bin");
  const gcloudLog = path.join(root, "gcloud.log");
  const BOOK = "tiny-book";
  const epDir = path.join(work, BOOK, "ep-01");
  const VOICES = ["af_heart", "am_michael"];
  const TEXT = ["Hello there, small world. A second sentence here.", "The last scene ends now."];
  const LINES = ["Hello there, small world.", "A second sentence here.", "The last scene ends now."];
  const dbName = `mintsy_studio_test_${randomUUID().slice(0, 8)}`;

  let jobs: typeof import("../jobs");
  let publish: typeof import("../steps/publish");
  let voiceSteps: typeof import("../steps/voice");
  let renderStep: typeof import("../steps/render");
  let client: import("mongodb").MongoClient;
  let db: import("mongodb").Db;
  type Book = { _id: string; episodes: Record<string, never>[] } & Record<string, unknown>;

  const books = () => db.collection<Book>("books");
  const live = () => ({
    number: 1,
    title: "Edited live title",
    summary: "Edited summary",
    takeaways: ["Edited takeaway"],
    durationSec: 100,
    transcript: LINES.map((text, i) => ({ startSec: i, text })),
    videoPath: "books/tiny-book/1-old.mp4",
    hlsPath: "books/tiny-book/1-old/master.m3u8",
    thumbnailPath: "books/tiny-book/1-old.jpg",
    voices: [{ id: "stale", name: "Stale", isDefault: true, videoPath: "stale.mp4", durationSec: 1, transcript: [], captions: [] }],
    status: "published",
  });
  const seed = async () => {
    await books().deleteMany({});
    await books().insertOne({ _id: BOOK, title: "Tiny", episodes: [live(), { ...live(), number: 2, title: "Second" }], status: "published" } as never);
  };
  const editTranscript = () => books().updateOne({ _id: BOOK, "episodes.number": 1 } as never, { $set: { "episodes.$.transcript": [{ startSec: 1, text: "An edited line." }, { startSec: 2, text: LINES[1] }] } } as never);
  const job = (kind: string) => ({ _id: new ObjectId(), kind, bookId: BOOK, chapter: 1, status: "running", log: [], createdAt: new Date() }) as never;
  const episode = async (n = 1) => (await books().findOne({ _id: BOOK }))!.episodes.find((e) => (e.number as unknown as number) === n)! as unknown as ReturnType<typeof live>;

  before(async () => {
    process.env.DOTENV_CONFIG_PATH = "/dev/null";
    process.env.STUDIO_WORK_DIR = work;
    process.env.MEDIA_BUCKET = "gs://stub-bucket-not-real";
    process.env.KOKORO_VOICES = VOICES.join(",");
    process.env.KOKORO_SPEED = "1";
    delete process.env.STUDIO_WORKER_DRY_RUN;
    delete process.env.MONGODB_URI;

    // Stubs first on PATH: gcloud only records, and both can be told to fail
    mkdirSync(bin);
    const realFfmpeg = execFileSync("which", ["ffmpeg"]).toString().trim();
    writeFileSync(path.join(bin, "gcloud"), `#!/bin/sh\necho "$*" >> "${gcloudLog}"\ncase "$*" in *"$STUB_GCLOUD_FAIL_ON"*) [ -n "$STUB_GCLOUD_FAIL_ON" ] && exit 1;; esac\nexit 0\n`);
    writeFileSync(path.join(bin, "ffmpeg"), `#!/bin/sh\ncase "$*" in *"$STUB_FFMPEG_FAIL_ON"*) [ -n "$STUB_FFMPEG_FAIL_ON" ] && exit 1;; esac\nexec "${realFfmpeg}" "$@"\n`);
    chmodSync(path.join(bin, "gcloud"), 0o755);
    chmodSync(path.join(bin, "ffmpeg"), 0o755);
    process.env.PATH = `${bin}:${process.env.PATH}`;

    jobs = await import("../jobs");
    publish = await import("../steps/publish");
    voiceSteps = await import("../steps/voice");
    renderStep = await import("../steps/render");
    const { wordsToAlignment } = await import("../tts");
    const { MongoClient } = await import("mongodb");
    client = await new MongoClient(uri!, { serverSelectionTimeoutMS: 3000 }).connect();
    db = client.db(dbName);

    // A two-scene episode whose narration is already "voiced": cached clips, so Kokoro never starts
    mkdirSync(epDir, { recursive: true });
    writeFileSync(path.join(work, BOOK, "book.json"), JSON.stringify({ title: "Tiny", author: "A", category: "History", description: "d", coverTone: "#E7DFCF", tint: "#3B3426", chapters: [] }));
    writeFileSync(path.join(epDir, "script.json"), JSON.stringify({ title: "Script title", summary: "Script summary", takeaways: ["Script takeaway"], narration: TEXT }));
    const scenes = TEXT.map((narration) => ({
      narration,
      beats: [{ startCue: "", background: "mint", beat: { layout: "headline", lines: [{ text: "Tape check", highlight: "", cue: "" }], numbered: false, stamp: { text: "", cue: "" } } }],
    }));
    writeFileSync(path.join(epDir, "scenes.json"), JSON.stringify(scenes));
    for (const [n, voice] of VOICES.entries()) {
      const dir = path.join(epDir, "audio", `kokoro-${voice}`);
      mkdirSync(dir, { recursive: true });
      for (const [i, text] of TEXT.entries()) {
        const name = String(i + 1).padStart(2, "0");
        const words = text.split(" ").map((w, k) => ({ word: w.replace(/[.,]/g, ""), start: 0.2 + k * (0.2 + n * 0.05), end: 0.4 + k * (0.2 + n * 0.05) }));
        execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=${300 + n * 200}:duration=${2 + n * 0.5}`, "-codec:a", "libmp3lame", path.join(dir, `${name}.mp3`)]);
        const hash = createHash("sha256").update(`kokoro|${voice}|1|${text}`).digest("hex").slice(0, 16);
        writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ hash, alignment: wordsToAlignment(text, words) }));
      }
    }
  });

  after(async () => {
    await db?.dropDatabase();
    await client?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("the voice step leaves one track per voice and no Kokoro process", async () => {
    await voiceSteps.writeVoice(epDir);
    const index = JSON.parse(readFileSync(path.join(epDir, "voices/index.json"), "utf8"));
    assert.deepEqual(index.voices.map((v: { voice: string }) => v.voice), VOICES);
  });

  test("uploading without renders fails before any upload", async () => {
    writeFileSync(path.join(epDir, "thumbnail.jpg"), "x");
    writeFileSync(path.join(epDir, "episode.mp4"), "an old render with no stamp");
    const fields = await publish.episodeFields(1, epDir);
    rmSync(gcloudLog, { force: true });
    await assert.rejects(publish.uploadMedia(BOOK, 1, epDir, fields), /has changed since episode\.mp4 was rendered/);
    assert.equal(existsSync(gcloudLog), false);
    rmSync(path.join(epDir, "thumbnail.jpg"));
    rmSync(path.join(epDir, "episode.mp4"));
  });

  test("remaster of a missing episode fails before rendering, and creates nothing", async () => {
    await books().deleteMany({});
    await books().insertOne({ _id: BOOK, episodes: [] } as never);
    await assert.rejects(jobs.runJob(db, job("remaster")), /no episode 1 in books/);
    assert.deepEqual((await books().findOne({ _id: BOOK }))!.episodes, []);
    assert.equal(existsSync(path.join(epDir, "episode.mp4")), false);
  });

  test("remaster with edits or without local files fails, and spends nothing", async () => {
    await seed();
    await assert.rejects(jobs.runJob(db, { ...(job("remaster") as object), scriptJson: {} } as never), /takes no script/);
    const scenes = path.join(epDir, "scenes.json");
    cpSync(scenes, `${scenes}.bak`);
    rmSync(scenes);
    await assert.rejects(jobs.runJob(db, job("remaster")), /won't regenerate/);
    cpSync(`${scenes}.bak`, scenes);
    rmSync(`${scenes}.bak`);
  });

  test("remaster: a voice failing partway leaves the episode unchanged", { timeout: 300_000 }, async () => {
    await seed();
    const before = await books().findOne({ _id: BOOK });
    rmSync(gcloudLog, { force: true });
    // Fails the second voice's last step, after the first voice has finished
    process.env.STUB_FFMPEG_FAIL_ON = "renders/kokoro-am_michael";
    await assert.rejects(jobs.runJob(db, job("remaster")));
    delete process.env.STUB_FFMPEG_FAIL_ON;
    assert.deepEqual(await books().findOne({ _id: BOOK }), before);
    assert.equal(existsSync(gcloudLog), false, "nothing is uploaded");
    assert.ok(existsSync(path.join(epDir, "episode.mp4")), "the first voice did render");
  });

  test("remaster: swaps media and voices, keeps status and text, and leaves other episodes alone", { timeout: 300_000 }, async () => {
    await seed();
    const result = (await jobs.runJob(db, job("remaster"))) as import("../jobs").RemasterResult;
    const ep = await episode();
    assert.equal(ep.status, "published");
    assert.equal(ep.title, "Edited live title");
    assert.equal(ep.summary, "Edited summary");
    assert.deepEqual(ep.takeaways, ["Edited takeaway"]);
    assert.deepEqual((await episode(2)).videoPath, live().videoPath);
    assert.deepEqual((await episode(2)).voices, live().voices);

    assert.deepEqual(ep.voices.map((v) => v.id), VOICES);
    const [main, second] = ep.voices;
    assert.equal(main.isDefault, true);
    assert.equal(second.isDefault, false);
    assert.equal(main.videoPath, ep.videoPath);
    assert.equal((main as { hlsPath?: string }).hlsPath, ep.hlsPath);
    assert.equal(main.durationSec, ep.durationSec);
    assert.deepEqual(main.transcript, ep.transcript);
    assert.notEqual(main.videoPath, second.videoPath);
    assert.notEqual(main.durationSec, second.durationSec);
    assert.equal(main.transcript.length, 3);
    assert.equal(second.transcript.length, 3);
    for (const v of ep.voices) {
      assert.ok(Number.isInteger(v.durationSec));
      assert.ok(v.captions.length > 0);
    }
    assert.ok(ep.thumbnailPath!.endsWith(".jpg"));

    // The job result stays small: no timed text goes into studio_jobs
    assert.deepEqual(Object.keys(result).sort(), ["durationSec", "hlsPath", "thumbnailPath", "transcriptLinesChanged", "videoPath", "voices"]);
    assert.deepEqual(result.voices, VOICES);
    assert.equal(result.transcriptLinesChanged, 0);
    assert.deepEqual(ep.transcript.map((l) => l.text), LINES);

    // Each voice's MP4 and HLS went up under its own prefix, with master.m3u8 after its files
    const log = readFileSync(gcloudLog, "utf8").trim().split("\n");
    for (const v of ep.voices) {
      const mp4 = log.findIndex((l) => l.includes(`gs://stub-bucket-not-real/${v.videoPath}`));
      const prefix = v.videoPath.replace(/\.mp4$/, "");
      const lines = log.map((l, i) => [l, i] as const).filter(([l]) => l.includes(`gs://stub-bucket-not-real/${prefix}/`));
      assert.ok(mp4 >= 0 && lines.length > 0, `${v.id} uploaded`);
      assert.ok(lines[lines.length - 1][0].includes("master.m3u8"), `${v.id}: master last`);
    }
    assert.ok(log.every((l) => l.includes("gs://stub-bucket-not-real/")), "nothing else is touched");
  });

  test("remaster: differing transcript text refuses before voicing, rendering or uploading, and leaves the doc alone", async () => {
    await seed();
    await editTranscript();
    const before = await books().findOne({ _id: BOOK });
    rmSync(gcloudLog, { force: true });
    const rendered = readFileSync(path.join(epDir, "render-stamp.json"), "utf8");
    const started = Date.now();
    await assert.rejects(
      jobs.runJob(db, job("remaster")),
      (err: Error) => {
        assert.match(err.message, /2 transcript line\(s\) in books differ/);
        assert.match(err.message, /line 1: books has "An edited line\.", the remaster would write "Hello there, small world\."/);
        assert.match(err.message, /line 3: books has \(no line\), the remaster would write "The last scene ends now\."/);
        assert.match(err.message, /overwriteTranscript: true/);
        return true;
      },
    );
    assert.ok(Date.now() - started < 3000, "no render ran");
    assert.deepEqual(await books().findOne({ _id: BOOK }), before);
    assert.equal(existsSync(gcloudLog), false, "the bucket is untouched");
    assert.equal(readFileSync(path.join(epDir, "render-stamp.json"), "utf8"), rendered);
  });

  test("remaster: an edit saved during the render still refuses before the write", async () => {
    await seed();
    const fields = await publish.episodeFields(1, epDir);
    const prefix = "books/tiny-book/1-new";
    const media = {
      videoPath: `${prefix}.mp4`,
      thumbnailPath: `${prefix}.jpg`,
      hlsPath: `${prefix}/master.m3u8`,
      voices: fields.voices.map((v, i) => ({ ...v, videoPath: `${prefix}${i || ""}.mp4`, hlsPath: i ? `${prefix}${i}/master.m3u8` : `${prefix}/master.m3u8` })),
    };
    await editTranscript();
    const before = await books().findOne({ _id: BOOK });
    await assert.rejects(jobs.swapEpisodeMedia(db, { bookId: BOOK }, { ...fields, ...media }), /2 transcript line\(s\)/);
    assert.deepEqual(await books().findOne({ _id: BOOK }), before);
  });

  test("remaster: a timing-only difference passes", { timeout: 300_000 }, async () => {
    await seed();
    await books().updateOne({ _id: BOOK, "episodes.number": 1 } as never, { $set: { "episodes.$.transcript": LINES.map((text, i) => ({ startSec: 50 + i, text })) } } as never);
    const result = (await jobs.runJob(db, job("remaster"))) as import("../jobs").RemasterResult;
    assert.equal(result.transcriptLinesChanged, 0);
    const ep = await episode();
    assert.notEqual(ep.transcript[0].startSec, 50, "times come from the new render");
    assert.notEqual(ep.videoPath, live().videoPath);
  });

  test("remaster: overwriteTranscript replaces differing text and reports it", { timeout: 300_000 }, async () => {
    await seed();
    await editTranscript();
    const result = (await jobs.runJob(db, { ...(job("remaster") as object), overwriteTranscript: true } as never)) as import("../jobs").RemasterResult;
    assert.equal(result.transcriptLinesChanged, 2);
    const ep = await episode();
    assert.deepEqual(ep.transcript.map((l) => l.text), LINES);
    assert.equal(ep.status, "published");
  });

  test("the public dir holds only audio and brand files, never renders or HLS", async () => {
    assert.ok(existsSync(path.join(epDir, "episode.mp4")));
    assert.ok(existsSync(path.join(epDir, "renders/kokoro-am_michael/episode.mp4")));
    assert.ok(existsSync(path.join(epDir, "renders/kokoro-am_michael/hls/master.m3u8")));
    const stage = await renderStep.stagePublicDir(epDir);
    const contents = readdirSync(stage, { recursive: true }).map(String);
    rmSync(stage, { recursive: true });
    assert.deepEqual(readdirSync(path.join(epDir, "brand")).sort(), ["intro-sting.mp3", "music-bed.mp3"]);
    assert.ok(contents.includes(path.join("audio", "kokoro-am_michael", "01.mp3")));
    assert.ok(contents.includes(path.join("brand", "music-bed.mp3")));
    assert.deepEqual(contents.filter((f) => /\.mp4$|\.m3u8$|\.m4s$|^renders|^hls/.test(f)), []);
  });

  test("remaster: an upload failing partway leaves the episode unchanged", { timeout: 300_000 }, async () => {
    await seed();
    const before = await books().findOne({ _id: BOOK });
    process.env.STUB_GCLOUD_FAIL_ON = "stream_0";
    await assert.rejects(jobs.runJob(db, job("remaster")));
    delete process.env.STUB_GCLOUD_FAIL_ON;
    assert.deepEqual(await books().findOne({ _id: BOOK }), before);
  });

  test("upload job: returns to draft, rewrites stale voices and keeps its result small", { timeout: 300_000 }, async () => {
    await seed();
    const result = await jobs.runJob(db, job("upload"));
    const ep = await episode();
    assert.equal(ep.status, "draft");
    assert.equal(ep.title, "Script title");
    assert.deepEqual(ep.voices.map((v) => v.id), VOICES);
    assert.deepEqual(Object.keys(result).sort(), ["durationSec", "hlsPath", "thumbnailPath", "videoPath"]);
  });

  test("upload job: a track changed after the render is refused", { timeout: 300_000 }, async () => {
    await seed();
    const before = await books().findOne({ _id: BOOK });
    const file = path.join(epDir, "voices/kokoro-am_michael.json");
    const original = readFileSync(file, "utf8");
    writeFileSync(file, original.replace("Hello", "Howdy"));
    await assert.rejects(jobs.runJob(db, job("upload")), /kokoro-am_michael" has changed/);
    writeFileSync(file, original);
    assert.deepEqual(await books().findOne({ _id: BOOK }), before);
  });

  test("upload refuses different transcript line counts before uploading", async () => {
    const file = path.join(epDir, "voices/kokoro-am_michael.json");
    const original = readFileSync(file, "utf8");
    const track = JSON.parse(original);
    track.transcript.pop();
    writeFileSync(file, JSON.stringify(track));
    rmSync(gcloudLog, { force: true });
    await assert.rejects(jobs.runJob(db, job("upload")), /different transcript line counts \(af_heart: 3, am_michael: 2\)/);
    assert.equal(existsSync(gcloudLog), false);
    writeFileSync(file, original);
  });

  test("an episode with no voices folder: renders and uploads its one video, and clears stale voices", { timeout: 300_000 }, async () => {
    await seed();
    const legacy = path.join(work, BOOK, "ep-03");
    mkdirSync(legacy);
    const track = JSON.parse(readFileSync(path.join(epDir, "voice.json"), "utf8"));
    writeFileSync(path.join(legacy, "voice.json"), JSON.stringify(track));
    cpSync(path.join(epDir, "script.json"), path.join(legacy, "script.json"));
    cpSync(path.join(epDir, "audio"), path.join(legacy, "audio"), { recursive: true });
    await renderStep.render(BOOK, legacy);
    assert.ok(existsSync(path.join(legacy, "episode.mp4")));
    assert.equal(existsSync(path.join(legacy, "renders")), false);
    const fields = await publish.episodeFields(3, legacy);
    assert.deepEqual(fields.voices, []);
    const media = await publish.uploadMedia(BOOK, 3, legacy, fields);
    assert.deepEqual(media.voices, []);

    await jobs.upsertDraftEpisode(db, BOOK, { ...fields, ...media, number: 1 });
    const ep = await episode();
    assert.deepEqual(ep.voices, []);
    assert.equal(ep.videoPath, media.videoPath);
    await assert.rejects(jobs.swapEpisodeMedia(db, { bookId: BOOK }, { ...fields, ...media, number: 1 }), /at least one voice/);
  });

  test("bad values never reach books", async () => {
    await seed();
    const before = await books().findOne({ _id: BOOK });
    const fields = await publish.episodeFields(1, epDir);
    const path0 = "books/tiny-book/1-new";
    const media = {
      videoPath: `${path0}.mp4`,
      thumbnailPath: `${path0}.jpg`,
      hlsPath: `${path0}/master.m3u8`,
      voices: fields.voices.map((v, i) => ({ ...v, videoPath: i ? `${path0}-${i}.mp4` : `${path0}.mp4`, hlsPath: i ? `${path0}-${i}/master.m3u8` : `${path0}/master.m3u8` })),
    };
    const bad = { ...fields, ...media, durationSec: fields.durationSec + 0.5 };
    await assert.rejects(jobs.swapEpisodeMedia(db, { bookId: BOOK }, bad), /isn't a whole number/);
    await assert.rejects(jobs.upsertDraftEpisode(db, BOOK, bad), /isn't a whole number/);
    assert.deepEqual(await books().findOne({ _id: BOOK }), before);
  });

  describe("clip job", () => {
    const clip = (over: object = {}) => ({ ...(job("clip") as object), ...over }) as never;

    test("refuses episodes above the free tier, before anything else", async () => {
      await assert.rejects(jobs.runJob(db, { ...(job("clip") as object), chapter: 4 } as never), /only for the free episodes \(1 to 3\)/);
    });

    test("refuses a range under the minimum, naming its length", async () => {
      await seed();
      await assert.rejects(jobs.runJob(db, clip()), /Scenes 1 to 2 run .* under the 15 s minimum/);
    });

    test("refuses an unknown voice and lists the ones it has", async () => {
      await assert.rejects(jobs.runJob(db, clip({ voice: "zz_nobody" })), /no voice "zz_nobody".*af_heart, am_michael/);
    });

    test("refuses scenes.json that moved on from the voice track", async () => {
      const file = path.join(epDir, "scenes.json");
      const original = readFileSync(file, "utf8");
      writeFileSync(file, original.replace("Tape check", "Changed"));
      await assert.rejects(jobs.runJob(db, clip({ voice: "am_michael" })), /scenes\.json has changed since track "kokoro-am_michael"/);
      writeFileSync(file, original);
    });

    test("renders the chosen voice's scenes to clips/, without touching books or the bucket, and warns when unpublished", { timeout: 300_000 }, async () => {
      // Long enough for the minimum: scene 1 of the second voice with a stretched clip
      const track = path.join(epDir, "audio/kokoro-am_michael/01.mp3");
      const saved = `${track}.bak`;
      const index = path.join(epDir, "voices/index.json");
      cpSync(track, saved);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=500:duration=16", "-codec:a", "libmp3lame", track]);
      await voiceSteps.writeVoice(epDir);
      assert.ok(existsSync(index));

      await seed();
      await books().updateOne({ _id: BOOK }, { $set: { status: "draft" } });
      const before = await books().findOne({ _id: BOOK });
      rmSync(gcloudLog, { force: true });
      const warnings: string[] = [];
      const warn = console.warn;
      console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
      const result = (await jobs.runJob(db, clip({ voice: "am_michael", startScene: 1, endScene: 1 }))) as import("../jobs").ClipJobResult;
      console.warn = warn;

      assert.equal(result.videoPath, "clips/am_michael-s01-s01.mp4");
      assert.equal(result.episodePublished, false);
      assert.match(warnings.join("\n"), /isn't published/);
      assert.deepEqual([result.width, result.height], [1080, 1920]);
      assert.ok(Math.abs(result.durationSec - (Math.ceil(16.5 * 30) / 30 + 3.5)) < 0.2, `duration ${result.durationSec}`);
      const stream = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0", path.join(epDir, result.videoPath)]).toString().trim();
      assert.equal(stream, "1080,1920,30/1");
      assert.ok(existsSync(path.join(epDir, result.thumbnailPath)));
      // The review guide's magenta must never reach a clip that gets posted
      const frame = execFileSync("ffmpeg", ["-v", "error", "-ss", "8", "-i", path.join(epDir, result.videoPath), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1e8 });
      let magenta = 0;
      for (let i = 0; i < frame.length; i += 3) if (frame[i] > 190 && frame[i + 1] < 70 && frame[i + 2] > 170) magenta++;
      assert.ok(magenta < 50, `${magenta} guide-coloured pixels`);
      assert.deepEqual(await books().findOne({ _id: BOOK }), before, "books is untouched");
      assert.equal(existsSync(gcloudLog), false, "the bucket is untouched");

      await books().updateOne({ _id: BOOK }, { $set: { status: "published" } });
      cpSync(saved, track);
      rmSync(saved);
      await voiceSteps.writeVoice(epDir);
    });
  });
});
