import "server-only";
import path from "node:path";

function trimSlash(s: string) {
  return s.replace(/\/+$/, "");
}

export const env = {
  mongodbUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
  mongodbDb: process.env.MONGODB_DB ?? "mintsy",
  mediaBaseUrl: trimSlash(process.env.MEDIA_BASE_URL ?? "https://storage.googleapis.com/mintsy-media"),
  /** studio/work on this machine, for previewing renders before they're uploaded. */
  studioWorkDir: path.resolve(
    /* turbopackIgnore: true */ process.env.STUDIO_WORK_DIR ?? path.join(process.cwd(), "../../../studio/work"),
  ),
  uploadDir: path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")),
};
