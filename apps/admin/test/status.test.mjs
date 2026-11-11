// Publish rules (src/lib/status.ts). Runs with `pnpm test`: Node 24 strips the TypeScript types itself.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canPublishEpisode, canPublishEpisodes, canUnpublishEpisode, checkEpisodeSelection, formatList } from "../src/lib/status.ts";

/** An episode the API can serve. */
const ep = (number, status, extra = {}) => ({
  number,
  status,
  durationSec: 300,
  transcript: [{ startSec: 0 }, { startSec: 12 }],
  ...extra,
});
const drafts = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ep(from + i, "draft"));

describe("canPublishEpisodes", () => {
  it("publishes a contiguous run from nothing", () => {
    assert.deepEqual(canPublishEpisodes(drafts(1, 17), Array.from({ length: 17 }, (_, i) => i + 1)), { ok: true });
    assert.deepEqual(canPublishEpisodes(drafts(1, 5), [1, 2, 3]), { ok: true });
  });

  it("accepts the selection in any order and with repeats", () => {
    assert.deepEqual(canPublishEpisodes(drafts(1, 4), [3, 1, 2, 2]), { ok: true });
  });

  it("refuses a gap, naming the missing episodes", () => {
    const r = canPublishEpisodes(drafts(1, 6), [1, 2, 4, 6]);
    assert.equal(r.ok, false);
    assert.match(r.reason, /Publish episodes 3, 5 first or add them to the selection/);
  });

  it("refuses a selection that doesn't start at 1 when 1 isn't published", () => {
    const r = canPublishEpisodes(drafts(1, 3), [2, 3]);
    assert.equal(r.ok, false);
    assert.match(r.reason, /Publish episode 1 first or add it to the selection/);
  });

  it("refuses an already published episode, even when the rest is fine", () => {
    const eps = [ep(1, "published"), ep(2, undefined), ...drafts(3, 4)];
    const r = canPublishEpisodes(eps, [2, 3, 4]);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "Episode 2 is already published.");
  });

  it("refuses an episode that doesn't exist", () => {
    const r = canPublishEpisodes(drafts(1, 2), [1, 2, 3, 4]);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "Episodes 3, 4 don't exist yet.");
  });

  it("refuses an empty selection", () => {
    assert.equal(canPublishEpisodes(drafts(1, 2), []).ok, false);
  });

  it("refuses when any episode in the new run has a value the API can't serve, and names it", () => {
    const eps = [...drafts(1, 2), ep(3, "draft", { transcript: [{ startSec: 0 }, { startSec: 4.5 }] }), ...drafts(4, 5)];
    const r = canPublishEpisodes(eps, [1, 2, 3, 4, 5]);
    assert.equal(r.ok, false);
    assert.match(r.reason, /Episode 3: transcript line 2 startSec is 4\.5\./);
    assert.doesNotMatch(r.reason, /Episode [1245]:/);
    // Stopping before the bad episode is fine.
    assert.deepEqual(canPublishEpisodes(eps, [1, 2]), { ok: true });
  });

  it("refuses when the run would expose a later episode already marked published with a bad value", () => {
    const eps = [ep(1, "draft"), ep(2, "published", { durationSec: 61.2 })];
    const r = canPublishEpisodes(eps, [1]);
    assert.equal(r.ok, false);
    assert.match(r.reason, /Episode 2: durationSec is 61\.2/);
  });

  it("refuses voices without exactly one default", () => {
    const voice = (id, isDefault) => ({ id, isDefault, durationSec: 300, transcript: [{ startSec: 0 }] });
    const eps = [ep(1, "draft", { voices: [voice("a", true), voice("b", true)] })];
    const r = canPublishEpisodes(eps, [1]);
    assert.equal(r.ok, false);
    assert.match(r.reason, /2 default voices instead of exactly one/);
  });

  it("fills in behind already published episodes", () => {
    const eps = [ep(1, "published"), ep(2, undefined), ...drafts(3, 6)];
    assert.deepEqual(canPublishEpisodes(eps, [3, 4, 5, 6]), { ok: true });
    assert.deepEqual(canPublishEpisodes(eps, [3]), { ok: true });
  });

  it("closes a gap below episodes already marked published", () => {
    const eps = [ep(1, "published"), ep(2, "draft"), ep(3, "draft"), ep(4, "published"), ep(5, "draft")];
    assert.deepEqual(canPublishEpisodes(eps, [2, 3]), { ok: true });
    assert.deepEqual(canPublishEpisodes(eps, [2, 3, 5]), { ok: true });
    const r = canPublishEpisodes(eps, [3, 5]);
    assert.equal(r.ok, false);
    assert.match(r.reason, /Publish episode 2 first or add it/);
  });
});

describe("canPublishEpisode keeps its single-episode behaviour", () => {
  it("matches the bulk rule for one episode", () => {
    const eps = [ep(1, "published"), ...drafts(2, 4)];
    assert.deepEqual(canPublishEpisode(eps, 2), { ok: true });
    assert.equal(canPublishEpisode(eps, 1).reason, "Episode 1 is already published.");
    assert.equal(canPublishEpisode(eps, 9).reason, "Episode 9 doesn't exist yet.");
    assert.equal(
      canPublishEpisode(eps, 4).reason,
      "Publish episodes 2, 3 first: episodes go live only as a contiguous run from episode 1.",
    );
  });

  it("still refuses API problems", () => {
    assert.equal(canPublishEpisode([ep(1, "draft", { durationSec: undefined })], 1).ok, false);
  });
});

describe("checkEpisodeSelection (the order part the page checks as you tick)", () => {
  it("ignores API values", () => {
    assert.deepEqual(checkEpisodeSelection([{ number: 1, status: "draft" }], [1]), { ok: true });
  });
});

describe("canUnpublishEpisode is unchanged", () => {
  it("only the highest published", () => {
    const eps = [ep(1, "published"), ep(2, "published")];
    assert.equal(canUnpublishEpisode(eps, 1).ok, false);
    assert.deepEqual(canUnpublishEpisode(eps, 2), { ok: true });
  });
});

describe("formatList", () => {
  it("collapses runs of three or more", () => {
    assert.equal(formatList([1, 2, 3, 4, 5, 8, 10, 11, 12]), "1–5, 8, 10–12");
    assert.equal(formatList([2, 5, 9, 12]), "2, 5, 9, 12");
    assert.equal(formatList([1, 2]), "1, 2");
  });
});
