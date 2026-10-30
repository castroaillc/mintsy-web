import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { StatusBadge } from "@/components/badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBookPageData } from "@/lib/catalog";
import { toJobView } from "@/lib/jobs";
import { effectiveStatus, liveRunLength } from "@/lib/status";
import { BookStatusToggle } from "./book-status";
import { ChaptersTable } from "./chapters";
import { IngestPanel } from "./ingest-panel";
import { MetadataForm } from "./metadata-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/books/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export default async function BookPage({ params }: PageProps<"/books/[id]">) {
  const { id } = await params;
  const { book, latestIngest, chapters, jobs } = await getBookPageData(id);
  if (!book && jobs.length === 0) notFound();

  const status = book ? effectiveStatus(book.status) : latestIngest?.status === "failed" ? "ingest failed" : "ingesting";
  const live = book ? liveRunLength(book.episodes) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Books
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{book?.title ?? id}</h1>
          <StatusBadge status={status} />
        </div>
        <p className="font-mono text-xs text-faint">{id}</p>
      </div>

      <IngestPanel
        bookId={id}
        initialJobs={jobs.map(toJobView)}
        initialNow={new Date().toISOString()}
        hasBook={!!book}
      />

      {book && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
              <CardDescription>Shown on the book&apos;s page in the app.</CardDescription>
            </CardHeader>
            <CardContent>
              <MetadataForm
                bookId={id}
                initial={{
                  title: book.title ?? "",
                  author: book.author ?? "",
                  category: book.category ?? "",
                  description: book.description ?? "",
                  tint: book.tint ?? "#3B3426",
                  coverTone: book.coverTone ?? "#E7DFCF",
                  order: book.order ?? 0,
                }}
              />
            </CardContent>
          </Card>
          <BookStatusToggle bookId={id} status={effectiveStatus(book.status)} liveEpisodes={live} totalEpisodes={book.episodes.length} />
        </div>
      )}

      {(book || chapters.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Chapters</CardTitle>
            <CardDescription>
              Generate a script, review it, then render. Rendered episodes start as drafts. {live > 0 && `${live} live in the app.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ChaptersTable bookId={id} chapters={chapters} canQueue={!!book} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
