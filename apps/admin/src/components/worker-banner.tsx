import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { JobView } from "@/lib/types";

const STALE_MS = 30_000;

/** Shown when jobs have sat in the queue for more than 30s with nothing running. */
export function WorkerBanner({ jobs, now }: { jobs: JobView[]; now: number }) {
  const stale = jobs.filter((j) => j.status === "queued" && now - Date.parse(j.createdAt) > STALE_MS);
  const running = jobs.some((j) => j.status === "running");
  if (!stale.length || running) return null;
  return (
    <Alert className="border-brand/40 bg-brand/10 text-foreground">
      <TriangleAlert className="text-brand" />
      <AlertTitle>
        {stale.length} job{stale.length === 1 ? " has" : "s have"} been queued for over 30 seconds
      </AlertTitle>
      <AlertDescription>
        <p>
          Is the studio worker running? <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">cd studio &amp;&amp; pnpm worker</code>
        </p>
      </AlertDescription>
    </Alert>
  );
}
