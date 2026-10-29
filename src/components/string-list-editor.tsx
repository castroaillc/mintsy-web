"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Editable list of strings with add / remove / reorder. */
export function StringListEditor({
  id,
  items,
  onChange,
  multiline = false,
  addLabel = "Add",
  placeholder,
  errors,
}: {
  id: string;
  items: string[];
  onChange: (items: string[]) => void;
  multiline?: boolean;
  addLabel?: string;
  placeholder?: string;
  errors?: Record<number, string>;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 w-5 shrink-0 text-right text-xs tabular-nums text-faint">{i + 1}</span>
          <div className="flex-1">
            {multiline ? (
              <Textarea
                id={`${id}-${i}`}
                value={item}
                rows={3}
                placeholder={placeholder}
                aria-invalid={!!errors?.[i]}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ) : (
              <Input
                id={`${id}-${i}`}
                value={item}
                placeholder={placeholder}
                aria-invalid={!!errors?.[i]}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              />
            )}
            {errors?.[i] && <p className="mt-1 text-xs text-destructive">{errors[i]}</p>}
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, ""])}>
        <Plus /> {addLabel}
      </Button>
    </div>
  );
}
