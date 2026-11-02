import "server-only";
import { getBookPageData } from "./catalog";
import { applySelection, hasDryRunLog, planChapter, type PlannedChapter } from "./generate-all";
import { hasActiveJob } from "./jobs";
import { getChapterPages, getLocalPreview, getScriptFiles, hasScriptJson } from "./studio-work";

/** What each of the book's chapters still needs. Same chapters as the book page's table. */
export async function loadPlan(bookId: string, selected?: number[]): Promise<PlannedChapter[]> {
  const { chapters, jobs } = await getBookPageData(bookId);
  const pages = await getChapterPages(bookId);
  const plan = await Promise.all(
    chapters.map(async (c) => {
      const [active, preview, files, scriptJson] = await Promise.all([
        hasActiveJob(bookId, c.number),
        getLocalPreview(bookId, c.number),
        getScriptFiles(bookId, c.number),
        hasScriptJson(bookId, c.number),
      ]);
      // Newest first. A dry-run worker writes no files, so in that mode the job record stands in for them.
      const lastScript = jobs.find((j) => j.chapter === c.number && j.kind === "script" && j.status === "succeeded");
      const lastPreview = jobs.find((j) => j.chapter === c.number && j.kind === "render" && j.preview && j.status === "succeeded");
      const dryPreviewCurrent =
        !!lastPreview && hasDryRunLog(lastPreview) && (!lastScript || (lastPreview.finishedAt ?? lastPreview.createdAt) >= (lastScript.finishedAt ?? lastScript.createdAt));
      const renderCurrent = (!!preview.video && preview.video.version >= (files?.newestMs ?? 0)) || dryPreviewCurrent;
      return planChapter({
        number: c.number,
        title: c.title,
        pages: pages?.get(c.number) ?? null,
        episodeStatus: c.episodeStatus,
        active,
        scriptJobSucceeded: !!lastScript,
        scriptJobDryRun: !!lastScript && hasDryRunLog(lastScript),
        scriptOnDisk: !!files,
        scriptJsonOnDisk: scriptJson,
        renderCurrent,
      });
    }),
  );
  return applySelection(plan, selected);
}
