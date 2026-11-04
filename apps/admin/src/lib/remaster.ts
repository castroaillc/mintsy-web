/** What the worker's error starts with when a remaster stops on differing transcript text (apps/studio/pipeline/jobs.ts). */
const REFUSED = /^Remaster refused for /;

type RemasterJob<D> = { kind: string; status: string; error?: string; finishedAt?: D };

/**
 * The refusal text an overwriteTranscript retry may answer: this must be the chapter's latest remaster
 * job, failed on transcript differences, with no change to the episode since (the text would be out of date).
 * Dates are Date on the server and ISO strings in the browser.
 */
export function transcriptRefusal<D extends Date | string>(job: RemasterJob<D> | undefined, episodeUpdatedAt: D | Date | undefined | null): string | null {
  if (job?.kind !== "remaster" || job.status !== "failed" || !job.error || !REFUSED.test(job.error) || !job.finishedAt) return null;
  if (episodeUpdatedAt && new Date(episodeUpdatedAt).getTime() > new Date(job.finishedAt).getTime()) return null;
  return job.error;
}
