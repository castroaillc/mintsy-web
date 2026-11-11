"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useJobLog } from "@/hooks/use-job-log";
import type { JobView } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A job's log, collapsed by default. A finished job's log is fetched when it's first opened. */
export function JobLog({ job, follow, defaultOpen = false }: { job: JobView; follow?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLPreElement>(null);
  const lines = useJobLog(job, open);
  const count = lines?.length ?? job.logLines;

  useEffect(() => {
    if (follow && open && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines, follow, open]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        Log ({count} line{count === 1 ? "" : "s"})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre
          ref={ref}
          className="mt-2 max-h-72 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground"
        >
          <LogText lines={lines} />
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The log's text, or a placeholder while it loads. Shared with the Jobs table. */
export function LogText({ lines }: { lines: string[] | null }) {
  if (!lines) return "Loading the log…";
  return lines.length ? lines.join("\n") : "No output yet.";
}
