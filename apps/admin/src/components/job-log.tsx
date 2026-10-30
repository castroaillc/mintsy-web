"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function JobLog({ lines, follow, defaultOpen = false }: { lines: string[]; follow?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (follow && open && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines, follow, open]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        Log ({lines.length} line{lines.length === 1 ? "" : "s"})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre
          ref={ref}
          className="mt-2 max-h-72 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground"
        >
          {lines.length ? lines.join("\n") : "No output yet."}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
