import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { JobView, WorkerView } from "@/lib/types";

const STALE_MS = 30_000;

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>;
}

/**
 * Shown when jobs are queued and no studio worker is consuming this database's queue.
 * Workers write a heartbeat to `studio_workers`; when none is live we say so straight away.
 * Before the first poll (or with a worker that predates heartbeats) we fall back to
 * "queued for over 30s with nothing running".
 */
export function WorkerBanner({
  jobs,
  now,
  workers,
  db,
}: {
  jobs: JobView[];
  now: number;
  workers?: WorkerView[] | null;
  db?: string | null;
}) {
  const queued = jobs.filter((j) => j.status === "queued");
  const running = jobs.some((j) => j.status === "running");
  if (!queued.length || running) return null;

  const knownNoWorker = workers != null && workers.length === 0;
  const stale = queued.filter((j) => now - Date.parse(j.createdAt) > STALE_MS);
  if (!knownNoWorker && !stale.length) return null;

  return (
    <Alert className="border-brand/40 bg-brand/10 text-foreground">
      <TriangleAlert className="text-brand" />
      <AlertTitle>
        {knownNoWorker
          ? `No studio worker is connected to database “${db}”`
          : `${stale.length} job${stale.length === 1 ? " has" : "s have"} been queued for over 30 seconds`}
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>
          Start the dashboard and worker together with <Code>pnpm dev:studio</Code> (mintsy-web root), or run{" "}
          <Code>cd studio &amp;&amp; pnpm worker</Code>.
        </p>
        {db && (
          <p>
            If a worker is already running, it&apos;s on a different database: set <Code>MONGODB_DB={db}</Code> in{" "}
            <Code>studio/.env</Code> and restart it.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
