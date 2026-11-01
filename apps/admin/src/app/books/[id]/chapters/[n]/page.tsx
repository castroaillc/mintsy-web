import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getBookPageData, latestScript } from "@/lib/catalog";
import { toJobView } from "@/lib/jobs";
import { mediaUrl } from "@/lib/media";
import { getLocalCover, getLocalPreview } from "@/lib/studio-work";
import { ChapterView } from "./chapter-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/books/[id]/chapters/[n]">): Promise<Metadata> {
  const { id, n } = await params;
  return { title: `${id} · chapter ${n}` };
}

export default async function ChapterPage({ params }: PageProps<"/books/[id]/chapters/[n]">) {
  const { id, n: nRaw } = await params;
  const n = Number(nRaw);
  if (!Number.isInteger(n) || n < 1) notFound();
  const { book, chapters, jobs } = await getBookPageData(id);
  const chapter = chapters.find((c) => c.number === n);
  if (!book || !chapter) notFound();
  const [script, preview, localCover] = await Promise.all([latestScript(id, n), getLocalPreview(id, n), getLocalCover(id)]);
  const cover = localCover ? `/api/books/${id}/cover?v=${localCover.version}` : mediaUrl(book.coverPath);
  const prev = chapters.find((c) => c.number === n - 1);
  const next = chapters.find((c) => c.number === n + 1);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <Link href={`/books/${id}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> {book.title}
          </Link>
          <div className="flex gap-3 text-muted-foreground">
            {prev && (
              <Link href={`/books/${id}/chapters/${prev.number}`} className="hover:text-foreground">
                ← Chapter {prev.number}
              </Link>
            )}
            {next && (
              <Link href={`/books/${id}/chapters/${next.number}`} className="hover:text-foreground">
                Chapter {next.number} →
              </Link>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-end gap-4">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- local render or bucket image
            <img src={cover} alt={`${book.title} cover`} className="h-24 w-16 rounded object-cover shadow-md" />
          )}
          <div>
            <p className="text-sm text-muted-foreground">Chapter {n}</p>
            <h1 className="text-2xl font-bold">{chapter.title}</h1>
          </div>
        </div>
      </div>
      <ChapterView
        bookId={id}
        chapter={chapter}
        initialJobs={jobs.filter((j) => j.chapter === n && j.kind !== "ingest").map(toJobView)}
        initialNow={new Date().toISOString()}
        preview={preview}
        script={script ? { finishedAt: script.finishedAt.toISOString(), script: script.result.script, scenes: script.result.scenes } : null}
      />
    </div>
  );
}
