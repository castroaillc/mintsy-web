// GET /version: which build is running. Public, no auth, no database. Reports only the fields below;
// never echo other env values here. Doesn't import ./env.js, so it has no required env vars (and tests need no MongoDB).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { RequestHandler } from "express";

export interface VersionInfo {
  name: string;
  /** package.json version */
  version: string;
  /** Git commit the image was built from (GIT_SHA build arg); in dev, `git rev-parse --short HEAD` when available */
  commit: string | null;
  /** ISO time the image was built (BUILD_TIME build arg); null locally */
  buildTime: string | null;
  /** Cloud Run revision (K_REVISION); null outside Cloud Run */
  revision: string | null;
  /** NODE_ENV, "development" when unset */
  env: string;
  /** ISO time this process started */
  startedAt: string;
  uptimeSeconds: number;
}

const nonEmpty = (value: string | undefined) => (value && value.trim() ? value.trim() : null);

// src/version.ts (tsx) and dist/version.js (built, and /app/dist in the image) both sit one level below package.json
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { name?: string; version?: string };

function devCommit(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: new URL(".", import.meta.url),
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
      encoding: "utf8",
    });
    return nonEmpty(sha);
  } catch {
    return null; // git missing or not a checkout
  }
}

// Build-time values don't change while the process runs: resolve them once
const startedAtMs = Date.now() - process.uptime() * 1000;
const commit = nonEmpty(process.env.GIT_SHA) ?? devCommit();

export function versionInfo(): VersionInfo {
  return {
    name: pkg.name ?? "mintsy-backend",
    version: pkg.version ?? "0.0.0",
    commit,
    buildTime: nonEmpty(process.env.BUILD_TIME),
    revision: nonEmpty(process.env.K_REVISION),
    env: process.env.NODE_ENV || "development",
    startedAt: new Date(startedAtMs).toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

export const versionHandler: RequestHandler = (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(versionInfo());
};
