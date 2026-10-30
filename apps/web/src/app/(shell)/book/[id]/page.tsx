import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/server/graphql";
import { firstParam } from "@/lib/next-path";
import { BookView } from "./book-view";

/**
 * Series page (DeskBook / DeskBookFree / DeskBookTranscripts / DeskBookAbout). Rendered on the server with the
 * viewer's cookies for SEO and a fast first paint; the client view refetches for progress and fresh media.
 */
export async function generateMetadata({ params }: PageProps<"/book/[id]">): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id).catch(() => null);
  if (!book) return { title: "Series not found", robots: { index: false } };
  const description = book.description || `${book.title} by ${book.author}, as a series of 5-minute video episodes.`;
  const image = book.episodes.find((e) => e.thumbnailUrl)?.thumbnailUrl ?? undefined;
  return {
    title: `${book.title} by ${book.author}`,
    description,
    alternates: { canonical: `/book/${book.id}` },
    openGraph: {
      title: `${book.title} · mintsy`,
      description,
      type: "video.tv_show",
      url: `/book/${book.id}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: `${book.title} · mintsy`, description },
  };
}

export default async function BookPage({ params, searchParams }: PageProps<"/book/[id]">) {
  const { id } = await params;
  const { tab } = await searchParams;
  let book;
  try {
    book = await getBook(id);
  } catch {
    // API down: the client view shows the error state with Try again
    book = undefined;
  }
  if (book === null) notFound();
  const start = firstParam(tab);
  return <BookView id={id} initialBook={book} initialTab={start === "transcripts" || start === "about" ? start : "episodes"} />;
}
