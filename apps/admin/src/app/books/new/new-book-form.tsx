"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bookIdSchema } from "@/lib/schemas";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function NewBookForm() {
  const router = useRouter();
  const [bookId, setBookId] = useState("");
  const [touchedId, setTouchedId] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [remoteError, setRemoteError] = useState<{ id: string; error: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const local = bookId ? bookIdSchema.safeParse(bookId) : null;
  const localError = local && !local.success ? local.error.issues[0]?.message : null;
  const idError = localError ?? (remoteError?.id === bookId ? remoteError.error : null);

  // Check uniqueness against `books` and pending ingest jobs as the id is typed.
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
    if (!file || idError || !bookId) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("bookId", bookId);
    fd.set("pdf", file);
    try {
      const res = await fetch("/api/books", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? `Upload failed (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }
      toast.success("Uploaded. Ingest job queued.");
      router.push(`/books/${bookId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pdf">Book PDF</Label>
            <Input
              id="pdf"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !touchedId) setBookId(slugify(f.name));
              }}
            />
            {file && <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bookId">Book id</Label>
            <Input
              id="bookId"
              value={bookId}
              placeholder="psychology-of-money"
              className="font-mono"
              aria-invalid={!!idError}
              onChange={(e) => {
                setTouchedId(true);
                setBookId(e.target.value.trim());
              }}
            />
            {idError ? (
              <p className="text-xs text-destructive">{idError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Becomes the app&apos;s book id and the studio folder name. It can&apos;t be changed later.
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!file || !bookId || !!idError || submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Upload />}
            Upload and ingest
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
