#!/usr/bin/env node
// PreToolUse hook for Edit/Write/NotebookEdit: blocks writes outside the paths given as arguments.
// Usage (from an agent's frontmatter): node "$CLAUDE_PROJECT_DIR/.claude/hooks/scope-writes.mjs" backend [more/paths ...]
// Paths are relative to the repo root. Exit code 2 blocks the call and shows stderr to the agent.
import path from "node:path";

let raw = "";
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  let data = {};
  try { data = JSON.parse(raw || "{}"); } catch { process.exit(0); }
  const target = data.tool_input?.file_path ?? data.tool_input?.notebook_path;
  if (!target) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || data.cwd || process.cwd();
  const abs = path.resolve(data.cwd || root, target);
  const allowed = process.argv.slice(2).map((p) => path.resolve(root, p));
  if (allowed.some((a) => abs === a || abs.startsWith(a + path.sep))) process.exit(0);

  console.error(
    `Blocked: this agent may only write inside ${process.argv.slice(2).join(", ")}. ` +
    `${path.relative(root, abs)} belongs to another project. Don't edit it; put the change you need in your report so the orchestrator can hand it to the owning agent.`
  );
  process.exit(2);
});
