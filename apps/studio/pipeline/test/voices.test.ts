// The caption and voice rules, with no database, bucket or render. Run: pnpm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { phrases } from "../../src/collage/phrases";
import { FPS, INTRO_SEC, sceneFrames } from "../../src/episode/timing";
import { captionSize, CLIP_CONTENT, CLIP_SAFE, fitSize } from "../../src/collage/clipLayout";
import { selectClipScenes } from "../steps/clip";
import { buildCaptions, checkEpisodeVoices, checkVoiceText, voiceName } from "../voices";

const word = (text: string, startSec: number, endSec: number) => ({ text, startSec, endSec });
const voice = (over: object = {}) => ({
  id: "af_heart",
  name: "Heart",
  isDefault: true,
  durationSec: 10,
  transcript: [{ startSec: 5, text: "Hello there." }],
  captions: [{ startSec: 5.25, endSec: 6.5, text: "Hello there." }],
  videoPath: "books/b/1-aaaa.mp4",
  hlsPath: "books/b/1-aaaa/master.m3u8",
  ...over,
});
const other = (over: object = {}) => voice({ id: "am_michael", name: "Michael", isDefault: false, videoPath: "books/b/1-bbbb.mp4", hlsPath: "books/b/1-bbbb/master.m3u8", ...over });
const top = { durationSec: 10, transcript: voice().transcript, videoPath: voice().videoPath, hlsPath: voice().hlsPath };

test("phrases keep to 7 words and break on sentences", () => {
  const words = "one two three four five six seven eight nine. ten".split(" ").map((t, i) => word(t, i / 2, i / 2 + 0.5));
  assert.deepEqual(phrases(words).map((g) => g.length), [7, 2, 1]);
});

test("captions add the intro and every earlier scene's frames", () => {
  const scenes = [
    { audioSec: 2.01, words: [word("First.", 0.3, 1)] },
    { audioSec: 3.4, words: [word("Second", 0.25, 0.75), word("scene.", 0.75, 1.5)] },
    { audioSec: 1, words: [word("Third.", 0.5, 0.9)] },
  ];
  const second = INTRO_SEC + sceneFrames(2.01) / FPS;
  const third = second + sceneFrames(3.4) / FPS;
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.001, `${a} vs ${b}`);
  const captions = buildCaptions(scenes);
  assert.deepEqual(captions.map((c) => c.text), ["First.", "Second scene.", "Third."]);
  near(captions[0].startSec, 4.8);
  near(captions[1].startSec, second + 0.25);
  near(captions[1].endSec, second + 1.5);
  near(captions[2].startSec, third + 0.5);
  assert.ok(captions[0].startSec >= INTRO_SEC, "nothing is captioned during the intro");
});

test("captions: a phrase doesn't span two scenes, and a scene with no words gives none", () => {
  const captions = buildCaptions([{ audioSec: 1, words: [word("no", 0, 0.5)] }, { audioSec: 1 } as never, { audioSec: 1, words: [word("stop", 0, 0.5)] }]);
  assert.deepEqual(captions.map((c) => c.text), ["no", "stop"]);
  assert.deepEqual(buildCaptions([]), []);
});

test("voice names", () => {
  assert.equal(voiceName("af_heart"), "Heart");
  assert.equal(voiceName("bm_george"), "George");
});

test("valid voices pass, and no voices is allowed", () => {
  checkEpisodeVoices({ ...top, voices: [voice(), other()] });
  checkEpisodeVoices({ durationSec: 10, transcript: [], voices: [] });
});

const invalid: [string, object[], RegExp][] = [
  ["fractional durationSec", [voice({ durationSec: 279.17 })], /durationSec/],
  ["fractional transcript time", [voice({ transcript: [{ startSec: 5.5, text: "x" }] })], /transcript line/],
  ["undefined captions", [voice({ captions: undefined })], /captions isn't a list/],
  ["undefined transcript", [voice({ transcript: undefined })], /transcript isn't a list/],
  ["caption ending early", [voice({ captions: [{ startSec: 6, endSec: 5, text: "x" }] })], /caption/],
  ["no default", [voice({ isDefault: false })], /exactly one/],
  ["two defaults", [voice(), other({ isDefault: true })], /exactly one/],
  ["default not first", [other(), voice()], /must be the first/],
  ["same id", [voice(), other({ id: "af_heart" })], /ids must be different/],
  ["different line counts", [voice(), other({ transcript: [] })], /line counts \(af_heart: 1, am_michael: 0\)/],
];
for (const [name, voices, message] of invalid) {
  test(`rejected: ${name}`, () => {
    assert.throws(() => checkVoiceText(voices as never), message);
  });
}

const mismatched: [string, object, RegExp][] = [
  ["videoPath", { videoPath: "other.mp4" }, /videoPath differs/],
  ["hlsPath", { hlsPath: undefined }, /hlsPath differs/],
  ["durationSec", { durationSec: 11 }, /durationSec differs/],
  ["transcript", { transcript: [{ startSec: 6, text: "Hello there." }] }, /transcript differs/],
];
for (const [name, over, message] of mismatched) {
  test(`rejected: top-level ${name} that differs from the default voice`, () => {
    assert.throws(() => checkEpisodeVoices({ ...top, ...over, voices: [voice(), other()] }), message);
  });
}

test("rejected: missing videoPath, repeated videoPath, fractional top-level duration, undefined voices", () => {
  assert.throws(() => checkEpisodeVoices({ ...top, voices: [voice(), other({ videoPath: "" })] }), /needs a videoPath/);
  assert.throws(() => checkEpisodeVoices({ ...top, voices: [voice(), other({ videoPath: top.videoPath })] }), /different videoPaths/);
  assert.throws(() => checkEpisodeVoices({ ...top, durationSec: 10.5, voices: [] }), /top-level durationSec/);
  assert.throws(() => checkEpisodeVoices({ ...top }), /must be a list/);
});

test("with no voices, the top-level transcript still needs whole startSecs", () => {
  const withLine = (line: object) => ({ durationSec: 10, transcript: [line as { startSec: number; text: string }], voices: [] });
  for (const line of [{ startSec: 5.5, text: "x" }, { startSec: NaN, text: "x" }, { text: "x" }]) {
    assert.throws(() => checkEpisodeVoices(withLine(line)), /top-level transcript line/);
  }
  checkEpisodeVoices(withLine({ startSec: 5, text: "x" }));
});

const sec = (...lengths: number[]) => lengths.map((audioSec) => ({ audioSec }));

test("clip range: defaults to scene 1, taking the fewest scenes that reach the minimum", () => {
  assert.equal(selectClipScenes(sec(20, 10, 10)).endScene, 1);
  assert.equal(selectClipScenes(sec(8, 8, 8)).endScene, 2);
  assert.equal(selectClipScenes(sec(8, 8, 8), 2).endScene, 3);
  assert.equal(selectClipScenes(sec(8, 8, 8)).startScene, 1);
});

test("clip range: length limits, with the end card counted against the maximum", () => {
  assert.throws(() => selectClipScenes(sec(10), 1, 1), /under the 15 s minimum/);
  assert.throws(() => selectClipScenes(sec(4, 4, 4, 30)), /under the 15 s minimum/, "the default stops at 3 scenes");
  assert.throws(() => selectClipScenes(sec(30, 30), 1, 2), /over the 60 s maximum/);
  assert.throws(() => selectClipScenes(sec(56.5), 1, 1), /over the 60 s maximum/, "under 60 s, but not with the end card");
  assert.equal(selectClipScenes(sec(55.5), 1, 1).endScene, 1);
});

test("clip range: scene numbers and counts", () => {
  assert.throws(() => selectClipScenes(sec(10, 10, 10, 10), 1, 4), /at most 3 scenes/);
  assert.throws(() => selectClipScenes(sec(20), 2), /start scene 2/);
  assert.throws(() => selectClipScenes(sec(20), 0), /start scene 0/);
  assert.throws(() => selectClipScenes(sec(20, 20), 2, 1), /end scene 1/);
  assert.throws(() => selectClipScenes(sec(20, 20), 1, 1.5), /end scene 1\.5/);
});

test("clip text zone sits inside the safe area, even after the camera's 4% push", () => {
  const push = (edge: number, center: number) => center + (edge - center) * 1.04;
  assert.ok(push(CLIP_CONTENT.left, 540) >= CLIP_SAFE.left);
  assert.ok(push(CLIP_CONTENT.right, 540) <= CLIP_SAFE.right);
  assert.ok(push(CLIP_CONTENT.top, 960) >= CLIP_SAFE.top);
  assert.ok(push(CLIP_CONTENT.lowerRight, 540) <= CLIP_SAFE.lowerRight);
  assert.ok(push(CLIP_CONTENT.bottom, 960) <= CLIP_SAFE.bottom);
});

test("fitSize stays in range and shrinks for long text", () => {
  assert.equal(fitSize("Hi", 700, { max: 80, min: 30 }), 80);
  assert.equal(fitSize("x".repeat(500), 700, { max: 80, min: 30 }), 30);
  assert.ok(fitSize("a long heading for the card", 400, { max: 80, min: 20 }) < 80);
  assert.ok(fitSize("a long heading for the card", 400, { max: 80, min: 20, lines: 2 }) > fitSize("a long heading for the card", 400, { max: 80, min: 20 }));
});

test("captionSize shrinks a phrase that would otherwise climb into the text zone", () => {
  assert.equal(captionSize("Most of us grew up hearing some".split(" ")), 56);
  assert.ok(captionSize("Extraordinarily complicated responsibilities overwhelming contemporary businesspeople everywhere".split(" ")) < 56);
});
