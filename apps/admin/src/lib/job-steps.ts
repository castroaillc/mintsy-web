import type { JobView } from "./types";

/**
 * Turns a studio job's log into pipeline steps. The worker (studio/pipeline/episode.ts)
 * prints an unindented `<step>:` header when a step starts (or `<step>: <file> exists,
 * skipping`), then indented detail lines such as Claude token counts. Dry runs print
 * `<step>: (dry run)`. Lines before the first header (the `▶ …` banner) belong to no step.
 */

export type StepState = "pending" | "running" | "done" | "skipped" | "failed";

export type JobStep = {
  name: string;
  label: string;
  description: string;
  state: StepState;
  details: string[];
};

const STEP_INFO: Record<string, { label: string; description: string }> = {
  chapter: { label: "Extract chapter", description: "Pull this chapter's text out of the book PDF" },
  script: { label: "Write script", description: "Claude writes the ~5 minute narration, summary and takeaways" },
  scenes: { label: "Plan scenes", description: "Claude splits the narration into visual scenes and checks them" },
  voice: { label: "Voice", description: "Narrates each scene (ElevenLabs or local Kokoro voices) and times the transcript" },
  render: { label: "Render video", description: "Remotion renders the MP4 and thumbnail" },
  upload: { label: "Upload", description: "Goes to the media bucket and is saved in the catalog (episodes as drafts)" },
  cover: { label: "Render cover", description: "Renders the book cover from its current title, author, category and tone" },
};

const STEPS_BY_KIND: Record<JobView["kind"], string[]> = {
  ingest: [],
  script: ["chapter", "script", "scenes"],
  render: ["chapter", "script", "scenes", "voice", "render", "upload"],
  upload: ["upload"],
  cover: ["cover", "upload"],
};

// `script:`, `script: script.json exists, skipping`, dry run `render 50%: (dry run)`.
// Not `script narration changed …: regenerating scenes` (no colon right after the name).
const HEADER = /^([a-z]+)(?: \d+%)?:(?:\s+(.*))?$/;

export function jobSteps(job: JobView): JobStep[] {
  // A preview render and a cover without upload stop before the upload step
  const names = STEPS_BY_KIND[job.kind].filter(
    (n) => n !== "upload" || !((job.kind === "render" && job.preview) || (job.kind === "cover" && !job.upload)),
  );
  const steps = new Map<string, JobStep>(
    names.map((name) => [name, { name, ...STEP_INFO[name], state: "pending" as StepState, details: [] }]),
  );

  let current: JobStep | null = null;
  for (const line of job.log) {
    const header = /^\s/.test(line) ? null : line.match(HEADER);
    const step = header ? steps.get(header[1]) : undefined;
    if (step) {
      const rest = header![2] ?? "";
      if (/exists, skipping$/.test(rest)) {
        step.state = "skipped";
        step.details.push(rest);
        current = null;
        continue;
      }
      step.state = "done";
      if (rest) step.details.push(rest);
      current = step;
      continue;
    }
    if (current && line.trim() && !/^(✓|✗|▶|Done:)/.test(line.trim())) current.details.push(line.trim());
  }

  const last = current;
  if (job.status === "running") {
    const running = last ?? [...steps.values()].find((s) => s.state === "pending");
    if (running) running.state = "running";
  }
  if (job.status === "failed") {
    if (last) last.state = "failed";
    else {
      const firstPending = [...steps.values()].find((s) => s.state === "pending");
      if (firstPending) firstPending.state = "failed";
    }
  }
  // A succeeded job ran every step; the dry run only prints some of them.
  if (job.status === "succeeded") for (const s of steps.values()) if (s.state === "pending") s.state = "done";
  return [...steps.values()];
}
