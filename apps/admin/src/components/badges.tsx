import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tone = {
  live: "bg-success/15 text-success border-success/25",
  draft: "bg-muted text-muted-foreground border-border",
  busy: "bg-brand/15 text-brand border-brand/30",
  ready: "bg-sky-400/15 text-sky-300 border-sky-400/25",
  bad: "bg-destructive/15 text-destructive border-destructive/30",
  idle: "bg-transparent text-faint border-border",
} as const;

const map: Record<string, keyof typeof tone> = {
  published: "live",
  draft: "draft",
  ingesting: "busy",
  "ingest failed": "bad",
  queued: "idle",
  running: "busy",
  succeeded: "live",
  failed: "bad",
  "not started": "idle",
  "generating script": "busy",
  "script ready": "ready",
  rendering: "busy",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = tone[map[status] ?? "draft"];
  const busy = status === "running" || status === "rendering" || status === "generating script" || status === "ingesting";
  return (
    <Badge variant="outline" className={cn("capitalize", t, className)}>
      {busy && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
      {status}
    </Badge>
  );
}
