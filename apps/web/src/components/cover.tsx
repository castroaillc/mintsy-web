import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { coverInk, EPISODE_TINTS, type Book, type Episode } from "@/lib/types";
import { cx } from "./ui";

/**
 * The book's 2:3 cover: its rendered cover image (Book.coverUrl) when it has one, otherwise the
 * generated tile from the boards: the book's coverTone with its title and author.
 */
export function Cover({
  book,
  titleSize = 18,
  authorSize = 11,
  padding = 14,
  shadow = true,
  className,
  style,
}: {
  book: Pick<Book, "title" | "author" | "coverTone"> & { coverUrl?: string | null };
  titleSize?: number;
  authorSize?: number;
  padding?: number;
  shadow?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  if (book.coverUrl) {
    return (
      <div
        className={cx("box-border aspect-[2/3] overflow-hidden rounded-lg", className)}
        style={{ background: book.coverTone, boxShadow: shadow ? "0 14px 30px rgba(0,0,0,0.4)" : undefined, ...style }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived bucket URL; not worth the image optimizer */}
        <img src={book.coverUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={cx("box-border flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-lg", className)}
      style={{
        background: book.coverTone,
        color: coverInk(book.coverTone),
        padding,
        boxShadow: shadow ? "0 14px 30px rgba(0,0,0,0.4)" : undefined,
        ...style,
      }}
      aria-hidden="true"
    >
      <div className="font-display font-bold leading-[1.08]" style={{ fontSize: titleSize }}>
        {book.title}
      </div>
      <div className="font-medium" style={{ fontSize: authorSize }}>
        {book.author}
      </div>
    </div>
  );
}

/** Plain colour swatch (profile "In progress" rows, paywall context card). */
export function CoverSwatch({ tone, width, radius = 4 }: { tone: string; width: number; radius?: number }) {
  return <div className="flex-none aspect-[2/3]" style={{ width, background: tone, borderRadius: radius }} aria-hidden="true" />;
}

/** Cover + title + meta, linking to the series page. */
export function BookTile({ book, meta }: { book: Book; meta?: ReactNode }) {
  return (
    <Link href={`/book/${book.id}`} className="flex min-w-0 flex-col gap-2.5">
      <div className="dk-cover">
        <Cover book={book} />
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="text-[14px] font-semibold leading-[1.3]">{book.title}</div>
        <div className="text-[13px] text-ink-5">{meta ?? `${book.author} · ${book.episodes.length} eps`}</div>
      </div>
    </Link>
  );
}

export function BookGrid({ min = 160, children }: { min?: number; children: ReactNode }) {
  return (
    <div className="grid gap-x-5 gap-y-6" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}>
      {children}
    </div>
  );
}

export function episodeTint(index: number) {
  return EPISODE_TINTS[((index % EPISODE_TINTS.length) + EPISODE_TINTS.length) % EPISODE_TINTS.length];
}

/**
 * 16:9 episode thumbnail: the episode's thumbnail image when there is one, else a rotating tint, with the
 * episode number, an optional duration badge, lock overlay and progress bar.
 */
export function EpisodeThumb({
  episode,
  width,
  numberSize = 20,
  duration,
  locked,
  progress,
  numberPosition = "top",
  className,
}: {
  episode: Pick<Episode, "number" | "thumbnailUrl">;
  width: number | string;
  numberSize?: number;
  duration?: string;
  locked?: boolean;
  /** 0-1 */
  progress?: number;
  numberPosition?: "top" | "bottom";
  className?: string;
}) {
  return (
    <div
      className={cx("relative flex-none overflow-hidden rounded-[10px] aspect-video", className)}
      style={{
        width,
        backgroundColor: episodeTint(episode.number - 1),
        backgroundImage: episode.thumbnailUrl ? `linear-gradient(rgba(14,13,24,0.25), rgba(14,13,24,0.25)), url("${episode.thumbnailUrl}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      aria-hidden="true"
    >
      <div
        className={cx("absolute left-2.5 font-display font-bold text-ink", numberPosition === "top" ? "top-1.5" : "bottom-2")}
        style={{ fontSize: numberSize, textShadow: episode.thumbnailUrl ? "0 1px 4px rgba(0,0,0,0.6)" : undefined }}
      >
        {episode.number}
      </div>
      {duration ? (
        <div className="absolute bottom-2 right-1.5 rounded-md bg-[rgba(14,13,24,0.78)] px-1.5 py-0.5 text-[11px] font-semibold text-ink">
          {duration}
        </div>
      ) : null}
      {locked ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(14,13,24,0.55)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
      ) : null}
      {progress && progress > 0 ? (
        <div className="absolute bottom-0 left-0 h-[3px] bg-coral" style={{ width: `${Math.min(100, progress * 100)}%` }} />
      ) : null}
    </div>
  );
}
