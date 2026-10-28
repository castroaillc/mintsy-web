/** Fields that hold cue phrases in any scene format (text cards or collage). */
const CUE_KEYS = new Set(["cue", "startCue", "captionCue", "badgeCue", "verdictCue"]);

/** Every non-empty cue phrase in a scene, wherever it sits in the visual description. */
export function cuePhrases(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) cuePhrases(item, found);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (CUE_KEYS.has(key) && typeof child === "string" && child.trim()) found.push(child);
      else if (key !== "narration") cuePhrases(child, found);
    }
  }
  return found;
}
