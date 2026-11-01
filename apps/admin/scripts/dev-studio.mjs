// `pnpm dev:studio`: runs the admin dashboard and the studio worker together, both on the
// MongoDB settings from the admin's env files, so the worker can't consume a different
// database's queue than the one the dashboard writes to.
//
// The worker's own studio/.env still supplies everything else (API keys, bucket); only
// MONGODB_URI / MONGODB_DB / UPLOAD_DIR are passed from here (dotenv never overrides them).
// Set STUDIO_DIR if studio/ isn't at ../../../studio from this app.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const studioDir = path.resolve(process.env.STUDIO_DIR ?? path.join(adminDir, "../../../studio"));

// Same files and precedence as `next dev` (earlier files and the real environment win).
for (const name of [".env.development.local", ".env.local", ".env.development", ".env"]) {
  const file = path.join(adminDir, name);
  if (existsSync(file)) process.loadEnvFile(file);
}
// Same defaults as src/lib/env.ts.
const shared = {
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  MONGODB_DB: process.env.MONGODB_DB || "mintsy",
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR || path.join(adminDir, "uploads")),
};

if (!existsSync(path.join(studioDir, "package.json"))) {
  console.error(`studio not found at ${studioDir} (set STUDIO_DIR)`);
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(shared.MONGODB_URI).host;
  } catch {
    return "(unparsed URI)";
  }
})();
console.log(`dev:studio → dashboard + worker on ${host} / ${shared.MONGODB_DB}`);

const colors = { admin: "\x1b[36m", worker: "\x1b[35m" };
const children = new Map();

function run(name, cwd, args) {
  const child = spawn("pnpm", args, { cwd, env: { ...process.env, ...shared, FORCE_COLOR: "1" }, stdio: ["inherit", "pipe", "pipe"] });
  const prefix = `${colors[name]}[${name}]\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) process.stdout.write(prefix + line + "\n");
    });
    stream.on("end", () => buf && process.stdout.write(prefix + buf + "\n"));
  }
  child.on("exit", (code, signal) => {
    children.delete(name);
    console.log(`${prefix}exited (${signal ?? code})`);
    if (children.size === 0) process.exit(code ?? 0);
  });
  children.set(name, child);
}

run("admin", adminDir, ["dev"]);
run("worker", studioDir, ["worker"]);

// Ctrl-C reaches both children through the process group: the worker finishes (or, on a
// second Ctrl-C, aborts) its current job; we just wait for both to exit.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => {
  for (const c of children.values()) c.kill("SIGTERM");
});
