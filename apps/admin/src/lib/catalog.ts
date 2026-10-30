import "server-only";
import { booksCol, jobsCol } from "./mongo";
import { effectiveStatus, liveRunLength } from "./status";
import type { BookDoc, ContentStatus, EpisodeDoc, IngestResult, ScriptResult, StudioJob } from "./types";
import { listJobs } from "./jobs";

export type BookRow = {
  id: string;
  order: number | null;
  title: string;
  author: string;
  /** Catalog status, or the ingest state when the book isn't in `books` yet. */
  status: ContentStatus | "ingesting" | "ingest failed";
  published: number;
  live: number;
  total: number;
  updatedAt: string | null;
};

function lastUpdated(b: BookDoc): Date | null {
  const dates = [b.updatedAt, ...b.episodes.map((e) => e.updatedAt)].filter((d): d is Date => d instanceof Date);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

export async function listBookRows(): Promise<BookRow[]> {
  const books = await (await booksCol()).find().sort({ order: 1, _id: 1 }).toArray();
  console.log(`listBookRows: found ${books.length} books in catalog`);
  const rows: BookRow[] = books.map((b) => {
    const eps = b.episodes ?? [];
    const u = lastUpdated(b);
    return {
      id: b._id,
      order: b.order ?? null,
      title: b.title,
      author: b.author,
      status: effectiveStatus(b.status),
      published: eps.filter((e) => effectiveStatus(e.status) === "published").length,
      live: liveRunLength(eps),
      total: eps.length,
      updatedAt: u?.toISOString() ?? null,
    };
  });

  // Books whose ingest hasn't created the catalog doc yet.
  const known = new Set(books.map((b) => b._id));
  const ingests = await listJobs({ kind: "ingest" }, 500);
  const seen = new Set<string>();
  for (const j of ingests) {
    if (known.has(j.bookId) || seen.has(j.bookId)) continue;
    seen.add(j.bookId); // newest first, so this is the latest ingest for the id
    if (j.status === "succeeded") continue; // worker should have inserted the book; nothing to show
    rows.push({
      id: j.bookId,
      order: null,
      title: j.bookId,
      author: "",
      status: j.status === "failed" ? "ingest failed" : "ingesting",
      published: 0,
      live: 0,
      total: 0,
      updatedAt: (j.finishedAt ?? j.startedAt ?? j.createdAt).toISOString(),
    });
  }
  return rows;
}

/** A book id is taken if it's in `books` or has an ingest job that hasn't failed. */
export async function bookIdTaken(id: string) {
  if (await (await booksCol()).findOne({ _id: id }, { projection: { _id: 1 } })) return "A book with this id already exists.";
  const pending = await (await jobsCol()).findOne(
    { kind: "ingest", bookId: id, status: { $in: ["queued", "running", "succeeded"] } },
    { projection: { _id: 1 } },
  );
  if (pending) return "An ingest job for this id already exists.";
  return null;
}

export type ChapterState =
  | "not started"
  | "generating script"
  | "script ready"
  | "rendering"
  | "draft"
  | "published"
  | "failed";

export type ChapterRow = {
  number: number;
  title: string;
  state: ChapterState;
  episodeStatus: ContentStatus | null;
  /** A script job succeeded at some point, so there is a script to review. */
  hasScript: boolean;
  active: boolean;
  error: string | null;
  latestJobKind: StudioJob["kind"] | null;
};

export async function getBookPageData(id: string) {
  const book = await (await booksCol()).findOne({ _id: id });
  const jobs = await listJobs({ bookId: id }, 1000);
  const ingests = jobs.filter((j) => j.kind === "ingest");
  const latestIngest = ingests[0] ?? null;
  const succeededIngest = ingests.find((j) => j.status === "succeeded") ?? null;
  const ingestResult = (succeededIngest?.result as IngestResult | undefined) ?? null;

  const episodes: EpisodeDoc[] = book?.episodes ?? [];
  const titles = new Map<number, string>();
  for (const c of ingestResult?.chapters ?? []) titles.set(c.number, c.title);
  for (const e of episodes) if (!titles.has(e.number)) titles.set(e.number, e.title);

  const chapters: ChapterRow[] = [...titles.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, title]) => {
      const chapterJobs = jobs.filter((j) => j.chapter === number && j.kind !== "ingest");
      const latest = chapterJobs[0];
      const ep = episodes.find((e) => e.number === number);
      const episodeStatus = ep ? effectiveStatus(ep.status) : null;
      const active = latest ? latest.status === "queued" || latest.status === "running" : false;
      let state: ChapterState = "not started";
      if (latest && active) state = latest.kind === "script" ? "generating script" : "rendering";
      else if (latest?.status === "failed") state = "failed";
      else if (latest?.kind === "script" && latest.status === "succeeded") state = "script ready";
      else if (episodeStatus) state = episodeStatus;
      return {
        number,
        title: ep?.title ?? title,
        state,
        episodeStatus,
        hasScript: chapterJobs.some((j) => j.kind === "script" && j.status === "succeeded"),
        active,
        error: latest?.status === "failed" ? (latest.error ?? "Failed") : null,
        latestJobKind: latest?.kind ?? null,
      };
    });

  return { book, latestIngest, ingestResult, chapters, jobs };
}

/** The latest succeeded script job for a chapter (its result holds script.json + scenes.json). */
export async function latestScript(bookId: string, chapter: number) {
  const job = await (await jobsCol()).findOne(
    { bookId, chapter, kind: "script", status: "succeeded" },
    { sort: { createdAt: -1, _id: -1 } },
  );
  if (!job) return null;
  return { jobId: job._id.toHexString(), finishedAt: job.finishedAt ?? job.createdAt, result: job.result as ScriptResult };
}
