import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { StatusBadge } from "@/components/badges";
import { Time } from "@/components/time";
import { mediaUrl } from "@/lib/media";
import { booksCol } from "@/lib/mongo";
import { canPublishEpisode, canUnpublishEpisode, effectiveStatus } from "@/lib/status";
import { EpisodeEditor } from "./episode-editor";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/books/[id]/episodes/[n]">): Promise<Metadata> {
  const { id, n } = await params;
  return { title: `${id} · episode ${n}` };
}

export default async function EpisodePage({ params }: PageProps<"/books/[id]/episodes/[n]">) {
  const { id, n: nRaw } = await params;
  const n = Number(nRaw);
  if (!Number.isInteger(n) || n < 1) notFound();
  const book = await (await booksCol()).findOne({ _id: id });
  const ep = book?.episodes.find((e) => e.number === n);
  if (!book || !ep) notFound();

  const status = effectiveStatus(ep.status);
  const rule = status === "published" ? canUnpublishEpisode(book.episodes, n) : canPublishEpisode(book.episodes, n);
  const video = mediaUrl(ep.videoPath);
  const thumb = mediaUrl(ep.thumbnailPath);
  const numbers = book.episodes.map((e) => e.number).sort((a, b) => a - b);
  const prev = numbers.filter((x) => x < n).at(-1);
  const next = numbers.find((x) => x > n);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/books/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {book.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            <span className="text-muted-foreground">Episode {n} ·</span> {ep.title}
          </h1>
          <StatusBadge status={status} />
          {effectiveStatus(book.status) === "draft" && <span className="text-xs text-muted-foreground">(book is a draft)</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {Math.floor(ep.durationSec / 60)}:{String(Math.round(ep.durationSec % 60)).padStart(2, "0")} · updated <Time iso={ep.updatedAt?.toISOString()} />
          {prev !== undefined && (
            <>
              {" · "}
              <Link className="hover:text-foreground" href={`/books/${id}/episodes/${prev}`}>← Ep {prev}</Link>
            </>
          )}
          {next !== undefined && (
            <>
              {" · "}
              <Link className="hover:text-foreground" href={`/books/${id}/episodes/${next}`}>Ep {next} →</Link>
            </>
          )}
        </p>
      </div>

      <EpisodeEditor
        key={`${id}-${n}-${ep.updatedAt?.getTime() ?? 0}`}
        bookId={id}
        number={n}
        durationSec={ep.durationSec}
        status={status}
        rule={rule}
        videoUrl={video}
        thumbnailUrl={thumb}
        videoPath={ep.videoPath ?? null}
        initial={{
          title: ep.title ?? "",
          summary: ep.summary ?? "",
          takeaways: ep.takeaways ?? [],
          transcript: ep.transcript ?? [],
        }}
      />
    </div>
  );
}
