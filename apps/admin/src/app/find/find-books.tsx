"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Download, ExternalLink, FileInput, Globe, Loader2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { BookFile, BookResult, SourceId } from "@/lib/book-sources";
import { callApi } from "@/lib/client-api";
import { bookIdSchema } from "@/lib/schemas";

const SOURCE_LABEL: Record<SourceId, string> = { gutenberg: "Project Gutenberg", archive: "Internet Archive" };
const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

/** Search ideas per app category: classics that are public domain (verdicts still come from each result). */
const SUGGESTIONS: { category: string; queries: string[] }[] = [
  { category: "Finance", queries: ["The Science of Getting Rich", "Acres of Diamonds", "The Art of Money Getting", "Wealth of Nations"] },
  { category: "Business", queries: ["Scientific Management Taylor", "Pushing to the Front", "The Autobiography of Benjamin Franklin"] },
  { category: "Psychology", queries: ["The Crowd Le Bon", "As a Man Thinketh", "William James Psychology", "The Interpretation of Dreams"] },
  { category: "Productivity", queries: ["How to Live on 24 Hours a Day", "Self-Help Smiles", "Meditations Marcus Aurelius", "Seneca letters"] },
  { category: "History", queries: ["The Prince Machiavelli", "The Art of War", "Plutarch Lives", "The Federalist Papers"] },
  { category: "Health", queries: ["The Art of Living Long", "Walking Thoreau", "Fasting Cure Sinclair"] },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
}

function formatSize(bytes?: number) {
  if (!bytes) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function downloadHref(f: BookFile) {
  return `/api/find/download?${new URLSearchParams({ url: f.url, filename: f.filename })}`;
}

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; results: BookResult[]; errors: { source: SourceId; error: string }[] }
  | { kind: "error"; error: string };

export function FindBooks() {
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | SourceId>("all");
  const [format, setFormat] = useState<"any" | "pdf" | "epub">("any");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [importing, setImporting] = useState<{ book: BookResult; file: BookFile } | null>(null);
  const [worldwideOnly, setWorldwideOnly] = useState(true);

  async function search(e?: React.FormEvent, query = q) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/find?${new URLSearchParams({ q: query.trim(), source })}`);
      const data = (await res.json()) as Extract<SearchState, { kind: "done" }> & { error?: string };
      if (!res.ok) return setState({ kind: "error", error: data.error ?? `HTTP ${res.status}` });
      setState({ kind: "done", results: data.results, errors: data.errors });
    } catch (err) {
      setState({ kind: "error", error: err instanceof Error ? err.message : "Search failed" });
    }
  }

  const visible =
    state.kind === "done"
      ? state.results
          .map((b) => ({ ...b, files: format === "any" ? b.files : b.files.filter((f) => f.format === format) }))
          .filter((b) => b.files.length > 0 && (!worldwideOnly || b.rights.scope === "worldwide"))
      : [];
  const hiddenUsOnly =
    state.kind === "done" && worldwideOnly ? state.results.filter((b) => b.rights.scope === "us").length : 0;

  return (
    <div className="space-y-6">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Title, author or topic (e.g. Meditations Marcus Aurelius)"
          className="sm:flex-1"
          autoFocus
        />
        <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
          <SelectTrigger className="sm:w-48" aria-label="Source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="gutenberg">Project Gutenberg</SelectItem>
            <SelectItem value="archive">Internet Archive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
          <SelectTrigger className="sm:w-32" aria-label="Format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any format</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="epub">EPUB</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={q.trim().length < 2 || state.kind === "loading"}>
          {state.kind === "loading" ? <Loader2 className="animate-spin" /> : <Search />}
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={worldwideOnly} onCheckedChange={setWorldwideOnly} />
          Worldwide only
          <span className="text-xs text-muted-foreground">
            (the app is sold globally; US-only public domain books are still protected in the EU, UK and elsewhere)
          </span>
        </label>
      </div>

      {state.kind === "idle" && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Public-domain classics by app category. Each result is still checked and labelled.</p>
          {SUGGESTIONS.map((s) => (
            <div key={s.category} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 text-xs font-medium text-muted-foreground">{s.category}</span>
              {s.queries.map((query) => (
                <Button
                  key={query}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setQ(query);
                    void search(undefined, query);
                  }}
                >
                  {query}
                </Button>
              ))}
            </div>
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.kind === "done" &&
        state.errors.map((e) => (
          <Alert key={e.source}>
            <AlertDescription>
              {SOURCE_LABEL[e.source]} didn&apos;t respond: {e.error}
            </AlertDescription>
          </Alert>
        ))}

      {state.kind === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {state.kind === "done" && visible.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          No cleared {format === "any" ? "PDFs or EPUBs" : format.toUpperCase() + "s"} found.
        </p>
      )}
      {hiddenUsOnly > 0 && (
        <p className="text-xs text-muted-foreground">
          {hiddenUsOnly} result{hiddenUsOnly === 1 ? " is" : "s are"} public domain in the US only and hidden.{" "}
          <button type="button" className="underline hover:text-foreground" onClick={() => setWorldwideOnly(false)}>
            Show them
          </button>
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((b) => (
          <li key={`${b.source}:${b.id}`} className="flex gap-4 rounded-xl border bg-card p-4">
            {b.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote covers from many hosts
              <img src={b.coverUrl} alt="" loading="lazy" className="h-28 w-20 shrink-0 rounded-md bg-muted object-cover" />
            ) : (
              <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-md bg-muted">
                <BookOpen className="size-6 text-faint" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <a href={b.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-medium hover:text-brand">
                  <span className="line-clamp-2">{b.title}</span>
                  <ExternalLink className="mt-1 size-3 shrink-0 text-faint" />
                </a>
                <p className="truncate text-sm text-muted-foreground">
                  {b.authors.join(", ") || "Unknown author"}
                  {b.year ? ` · ${b.year}` : ""}
                  {b.language ? ` · ${b.language}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{SOURCE_LABEL[b.source]}</Badge>
                <RightsBadge rights={b.rights} />
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {b.rights.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {b.files.map((f) => {
                  const size = formatSize(f.size);
                  const tooBig = (f.size ?? 0) > MAX_IMPORT_BYTES;
                  return (
                    <div key={f.url} className="flex items-center gap-1 rounded-lg border p-1 pl-2 text-xs">
                      <span className="font-mono font-medium uppercase">{f.format}</span>
                      {f.converted && <span className="text-muted-foreground">from text</span>}
                      {size && <span className="text-muted-foreground">{size}</span>}
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                        <a href={downloadHref(f)} title={f.filename}>
                          <Download /> Download
                        </a>
                      </Button>
                      {f.format === "pdf" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={tooBig}
                          title={tooBig ? "Larger than the 200 MB import limit" : "Download into the studio and queue ingest"}
                          onClick={() => setImporting({ book: b, file: f })}
                        >
                          <FileInput /> Import
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <ImportDialog target={importing} onClose={() => setImporting(null)} />
    </div>
  );
}

function RightsBadge({ rights }: { rights: BookResult["rights"] }) {
  const worldwide = rights.scope === "worldwide";
  return (
    <Badge
      variant="outline"
      title={rights.summary}
      className={
        worldwide
          ? "border-success/30 bg-success/15 text-success"
          : "border-brand/30 bg-brand/15 text-brand"
      }
    >
      {worldwide ? <Globe /> : <ShieldCheck />}
      {rights.basis === "attribution" ? "CC BY · credit required" : worldwide ? "Public domain worldwide" : "Public domain · US only"}
    </Badge>
  );
}

function ImportDialog({ target, onClose }: { target: { book: BookResult; file: BookFile } | null; onClose: () => void }) {
  const router = useRouter();
  const [bookId, setBookId] = useState("");
  const [remoteError, setRemoteError] = useState<{ id: string; error: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [lastTarget, setLastTarget] = useState(target);
  if (target !== lastTarget) {
    setLastTarget(target);
    if (target) setBookId(slugify(target.book.title));
  }

  const local = bookId ? bookIdSchema.safeParse(bookId) : null;
  const localError = local && !local.success ? local.error.issues[0]?.message : null;
  const idError = localError ?? (remoteError?.id === bookId ? remoteError.error : null);

  useEffect(() => {
    if (!bookId || !bookIdSchema.safeParse(bookId).success) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/book-ids?id=${encodeURIComponent(bookId)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { ok: boolean; error?: string };
        setRemoteError(data.ok ? null : { id: bookId, error: data.error ?? "Not available" });
      } catch {
        // aborted
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [bookId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !bookId || idError) return;
    setSubmitting(true);
    const res = await callApi<{ bookId: string }>("/api/find/import", {
      method: "POST",
      body: { bookId, url: target.file.url },
    });
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Imported. Ingest job queued.");
    router.push(`/books/${res.data.bookId}`);
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Import as a new book</DialogTitle>
            <DialogDescription className="line-clamp-2">
              Downloads <span className="text-foreground">{target?.book.title}</span>
              {target?.file.size ? ` (${formatSize(target.file.size)})` : ""} into the studio and queues an ingest job.
              Nothing shows in the app until you publish.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="import-book-id">Book id</Label>
            <Input
              id="import-book-id"
              value={bookId}
              className="font-mono"
              aria-invalid={!!idError}
              onChange={(e) => setBookId(e.target.value.trim())}
            />
            {idError ? (
              <p className="text-xs text-destructive">{idError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Becomes the app&apos;s book id. It can&apos;t be changed later.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!bookId || !!idError || submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <FileInput />}
              {submitting ? "Downloading…" : "Import and ingest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
