// Prototype: generates a mascot reference and per-shot illustrations with Gemini on Vertex AI.
// Usage: npx tsx pipeline/illustrate.ts <book> <chapter>
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { episodeDir, WORK_DIR } from "./paths";

const PROJECT = process.env.GCP_PROJECT ?? "mintsy-prod";
const MODEL = process.env.IMAGE_MODEL ?? "gemini-3-pro-image";
const ENDPOINT = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;

const STYLE =
  "Hand-painted storybook illustration with soft gouache texture, warm muted palette with mustard-gold accents, " +
  "gentle cinematic lighting, clean shapes, 16:9 composition with the subject slightly off-centre and room around it. " +
  "No text, letters, numbers or captions anywhere in the image.";

const MASCOT =
  "Mintsy, the show's mascot: a small, friendly character with a round cream-coloured face, two simple black dot eyes, " +
  "rosy cheeks, a small sprig of two green mint leaves growing from the top of the head instead of hair, " +
  "wearing a mustard-yellow cardigan over a white collared shirt and brown trousers.";

/** Two shots per prototype scene; the mascot plays the people the narration describes. */
const SHOTS: { id: string; prompt: string }[] = [
  { id: "s1a", prompt: "Edwardian London, 1908. Mintsy in a brand-new tailored suit but a battered, patched old bowler hat, standing proudly in a lovely but half-empty flat: fine wallpaper, one lonely chair, bare floorboards, a single picture frame." },
  { id: "s1b", prompt: "Edwardian dining room. Mintsy as host proudly presents sparkling fine cut-glass goblets on a candlelit table, but the plate in the middle holds a grey, sad, overcooked leg of mutton with faint wavy smell lines. A guest in the foreground (seen from behind) leans back doubtfully." },
  { id: "s3a", prompt: "A cosy Edwardian study piled high with angry letters and folded newspapers, envelopes spilling off the desk. Mintsy sits at the desk reading one letter with raised eyebrows, more letters fluttering down." },
  { id: "s3b", prompt: "Mintsy stands before a tall bookshelf of identical money-advice pamphlets, pointing at a single conspicuous empty gap on the shelf, looking puzzled." },
  { id: "s5a", prompt: "Dawn light through a bedroom window. Mintsy sits up in bed, stretching, as a small leather purse on the bedside table glows and overflows with twenty-four tiny golden pocket watches." },
  { id: "s5b", prompt: "Three figures standing side by side on a sunny Edwardian street, each holding an identical glowing golden hourglass: a wealthy gentleman in a top hat and fur coat, a professor in a gown, and Mintsy in the middle. Equal, cheerful, democratic." },
];

function accessToken() {
  return execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
}

async function generate(prompt: string, aspectRatio: string, reference?: Buffer) {
  const parts: object[] = [];
  if (reference) parts.push({ inlineData: { mimeType: "image/png", data: reference.toString("base64") } });
  parts.push({ text: prompt });
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
    }),
  });
  if (!res.ok) throw new Error(`Vertex ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] };
  const image = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!image) throw new Error(`No image returned: ${JSON.stringify(json).slice(0, 500)}`);
  return Buffer.from(image, "base64");
}

async function main() {
  const [book, chapter] = process.argv.slice(2);
  const styleDir = path.join(WORK_DIR, "style");
  await mkdir(styleDir, { recursive: true });

  // One mascot reference shared by every episode
  const mascotPath = path.join(styleDir, "mascot.png");
  if (!existsSync(mascotPath)) {
    console.log("mascot reference");
    const sheet = await generate(
      `Character reference sheet on a plain cream background: ${MASCOT} Shown full body from the front and in three-quarter view, standing in a relaxed pose. ${STYLE}`,
      "16:9",
    );
    await writeFile(mascotPath, sheet);
  }
  const reference = await readFile(mascotPath);

  const outDir = path.join(episodeDir(book, Number(chapter)), "illustrations");
  await mkdir(outDir, { recursive: true });
  for (const shot of SHOTS) {
    const file = path.join(outDir, `${shot.id}.png`);
    if (existsSync(file)) continue;
    console.log(shot.id);
    await writeFile(
      file,
      await generate(`The attached image is the character reference for ${MASCOT} Keep the character exactly consistent with it. Scene: ${shot.prompt} ${STYLE}`, "16:9", reference),
    );
  }
  console.log(outDir);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
