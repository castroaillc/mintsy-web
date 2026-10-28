import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { ICON_NAMES } from "../../src/collage/iconNames";
import { CollageScene } from "../../src/collage/schema";
import { Scene } from "../../src/episode/schema";
import { generate, generateJson } from "../claude";
import { cuePhrases } from "../cues";
import { files } from "../paths";
import { normalize, readJson, writeJson } from "../util";
import type { Script } from "./script";

/** "collage" (default): paper-cutout scenes with icons and puppets. "cards": the original text-card templates. */
const STYLE = process.env.VIDEO_STYLE === "cards" ? "cards" : "collage";

const SPLIT_RULES = `- 10 to 16 scenes, each covering 40–90 words of narration (about 15–35 seconds).
- Copy the narration verbatim and in order: joined together, the scenes' narration must equal the full script, with every word exactly once. Split only between sentences.`;

const CUE_RULE = `- Every cue is a short phrase (2–6 words) copied exactly from that scene's narration, at the moment the element should appear. Order cues as they are spoken.`;

const CARDS_SYSTEM = `You are the visual director for mintsy, which turns book chapters into 5-minute narrated videos made of animated motion-graphics scenes.

Split the narration into scenes and choose one visual template for each:
${SPLIT_RULES}
- The first scene is "title" with kicker "Chapter N" and the episode title as headline. The last scene is "takeaways" with the script's three takeaways.
- In between, pick whatever best shows what the narrator is saying: "statement" for one key idea, "bullets" for several parallel points, "steps" for a sequence, "stat" only for a number that is spoken in that scene, "compare" for a contrast, "quote" only for a line the narration itself quotes. Vary the templates; avoid the same one twice in a row.
- On-screen text supports the voice, it doesn't repeat it: short phrases, never full sentences.
${CUE_RULE}`;

const COLLAGE_SYSTEM = `You are the visual director for mintsy, which turns book chapters into 5-minute narrated videos. The look is a playful paper-cutout collage: bold diagonal stripes, simple puppet figures, icon stickers, rubber stamps and chunky condensed captions, in the spirit of classic animated history explainers.

Split the narration into scenes and design each one:
${SPLIT_RULES}
- Show, don't caption: turn what the narrator says into a little picture. A story becomes a "stage" where the person and objects pop in as they're named; a contrast becomes "versus"; "everyone gets the same" becomes a "lineup" with a badge; a spoken number becomes a "counter"; a key claim or a list of phrases becomes a "headline", with a stamp when the point is that something never happened or is wrong.
- Use figures for people: pick the hat and outfit that say who they are, and a mood that fits. Use icons for things and ideas. Labels are tiny tags, not sentences.
- A scene may have a second beat when the narration clearly moves on to a new picture partway through; its startCue is where the switch happens. Most scenes need one beat.
- Vary layouts and backgrounds from scene to scene; never the same layout three times in a row.
- The last scene's final beat is "takeaways" with the script's three takeaways, each cued to where the recap says it.
- Text on screen is short: captions at most 5 words, headline lines at most 6, points at most 5.
${CUE_RULE}
- Icons must be one of these names: ${ICON_NAMES.join(", ")}.`;

const CardScenes = z.object({ scenes: z.array(Scene) });
const CollageScenes = z.object({ scenes: z.array(CollageScene) });
type AnyScenes = z.infer<typeof CardScenes> | z.infer<typeof CollageScenes>;

/** Every icon name used anywhere in a scene. */
function iconNames(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => iconNames(v, found));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "icon" && typeof child === "string") found.push(child);
      else iconNames(child, found);
    }
  }
  return found;
}

const KNOWN_ICONS = new Set<string>(ICON_NAMES);

/** Problems that would break the voice step or the timing of on-screen elements. */
function validate(result: AnyScenes, script: Script, split: string[] | undefined) {
  const problems: string[] = [];
  const scenes: (Scene | CollageScene)[] = result.scenes;
  const joined = normalize(scenes.map((s) => s.narration).join(" "));
  if (joined !== normalize(script.narration.join(" "))) {
    problems.push("The scenes' narration joined together does not exactly equal the script narration.");
  }
  if (split) {
    if (scenes.length !== split.length) problems.push(`Use exactly the ${split.length} given scenes, not ${scenes.length}.`);
    scenes.forEach((scene, i) => {
      if (split[i] !== undefined && normalize(scene.narration) !== normalize(split[i])) {
        problems.push(`Scene ${i + 1}: narration must be exactly the given scene ${i + 1} text.`);
      }
    });
  }
  scenes.forEach((scene, i) => {
    const narration = normalize(scene.narration).toLowerCase();
    for (const cue of cuePhrases(scene)) {
      if (!narration.includes(normalize(cue).toLowerCase())) {
        problems.push(`Scene ${i + 1}: cue "${cue}" is not in that scene's narration.`);
      }
    }
    for (const icon of iconNames(scene)) {
      if (!KNOWN_ICONS.has(icon)) problems.push(`Scene ${i + 1}: "${icon}" is not one of the listed icon names.`);
    }
    if ("beats" in scene) {
      if (scene.beats.length < 1 || scene.beats.length > 2) problems.push(`Scene ${i + 1}: use 1 or 2 beats.`);
      if (scene.beats[1] && !scene.beats[1].startCue) problems.push(`Scene ${i + 1}: the second beat needs a startCue.`);
    }
  });
  const last = scenes[scenes.length - 1];
  if (last && "beats" in last && last.beats[last.beats.length - 1]?.beat.layout !== "takeaways") {
    problems.push('The last scene must end with a "takeaways" beat.');
  }
  return problems;
}

/** The previous scene split, when the script hasn't changed since: reusing it keeps the cached narration audio valid. */
async function existingSplit(epDir: string, script: Script) {
  const file = path.join(epDir, files.scenes);
  if (!existsSync(file)) return undefined;
  const previous = await readJson<{ narration: string }[]>(file);
  const same = normalize(previous.map((s) => s.narration).join(" ")) === normalize(script.narration.join(" "));
  return same ? previous.map((s) => s.narration) : undefined;
}

export async function writeScenes(epDir: string) {
  const script = await readJson<Script>(path.join(epDir, files.script));
  const split = await existingSplit(epDir, script);
  const brief = `Episode title: ${script.title}\nTakeaways:\n${script.takeaways.map((t) => `- ${t}`).join("\n")}`;
  const content = split
    ? `${brief}\n\nThe narration is already split into ${split.length} scenes. Keep exactly this split, copying each scene's narration as given, and design the visuals:\n\n${split.map((text, i) => `<scene n="${i + 1}">\n${text}\n</scene>`).join("\n\n")}`
    : `${brief}\n\n<narration>\n${script.narration.join("\n\n")}\n</narration>`;
  if (split) console.log(`  keeping the existing ${split.length}-scene split`);

  const system = STYLE === "collage" ? COLLAGE_SYSTEM : CARDS_SYSTEM;
  const messages: Parameters<typeof generate>[0]["messages"] = [{ role: "user", content }];

  // One retry with the specific problems, since an inexact copy breaks narration timing
  for (let attempt = 1; ; attempt++) {
    const label = `${STYLE} scenes (attempt ${attempt})`;
    let result: AnyScenes | undefined;
    let problems: string[];
    let reply: string;
    if (STYLE === "collage") {
      // The collage schema is too nested for constrained decoding, so it is validated after the fact
      const out = await generateJson({ label, schema: CollageScenes, system, messages });
      reply = out.raw;
      if ("data" in out) result = out.data;
      problems = "data" in out ? validate(out.data, script, split) : out.problems;
    } else {
      result = await generate({ label, schema: CardScenes, system, messages });
      reply = JSON.stringify(result);
      problems = validate(result, script, split);
    }
    if (result && problems.length === 0) {
      const summary = result.scenes.map((s) => ("beats" in s ? s.beats.map((b) => b.beat.layout).join("→") : s.visual.type)).join(", ");
      console.log(`  ${result.scenes.length} scenes: ${summary}`);
      await writeJson(path.join(epDir, files.scenes), result.scenes);
      return;
    }
    if (attempt === 2) throw new Error(`Scenes failed validation:\n${problems.join("\n")}`);
    console.log(`  ${problems.length} problem(s), retrying:\n    ${problems.slice(0, 5).join("\n    ")}`);
    messages.push(
      { role: "assistant", content: reply },
      { role: "user", content: `Fix these problems and return the complete corrected scenes:\n${problems.join("\n")}` },
    );
  }
}
