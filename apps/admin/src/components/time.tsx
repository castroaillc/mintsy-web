"use client";

/** Local date/time. Server and browser run on the same machine, so the time zone matches. */
export function Time({ iso, mode = "datetime" }: { iso: string | null | undefined; mode?: "datetime" | "time" }) {
  if (!iso) return <span className="text-faint">—</span>;
  const d = new Date(iso);
  const text =
    mode === "time"
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <time dateTime={iso} title={d.toString()} suppressHydrationWarning>
      {text}
    </time>
  );
}

export function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
