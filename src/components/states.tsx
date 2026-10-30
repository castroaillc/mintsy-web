"use client";

import Link from "next/link";
import { APP_STORE_URL, BOOK_REQUEST_MAILTO } from "@/lib/config";
import { useOnline } from "@/lib/data";
import { OfflineIcon, SearchIcon } from "./icons";
import { btn, cx, H2 } from "./ui";

/** Loading · Home skeleton (DeskStates). */
export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading">
      <div className="dk-skel h-12 w-[60%] max-w-[560px] rounded-xl" />
      <div className="dk-skel h-[280px] w-full rounded-[22px]" />
      <GridSkeleton />
    </div>
  );
}

export function GridSkeleton({ count = 6, min = 160 }: { count?: number; min?: number }) {
  return (
    <div className="grid gap-x-5 gap-y-6" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="dk-skel aspect-[2/3] rounded-lg" />
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 4, height = 92 }: { count?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="dk-skel w-full rounded-[14px]" style={{ height }} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="dk-skel h-5 w-32 rounded-lg" />
      <div className="dk-skel h-10 w-[50%] rounded-xl" />
      <div className="dk-skel h-[180px] w-full rounded-[18px]" />
      <div className="dk-skel h-5 w-[70%] rounded-lg" />
    </div>
  );
}

/** Error · Series failed to load (DeskStates). */
export function ErrorState({
  title = "Couldn’t load this page",
  body = "Something went wrong on our side. Your progress is safe.",
  onRetry,
  errorRef,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  errorRef?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-2 py-6 text-center" role="alert">
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-error-bg">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFB4AE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4l9 16H3zM12 10v4M12 17h.01" />
        </svg>
      </div>
      <H2 size={20}>{title}</H2>
      <div className="text-[15px] text-ink-4">{body}</div>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
        {onRetry ? (
          <button type="button" onClick={onRetry} className={btn("light", "sm")}>
            Try again
          </button>
        ) : null}
        <Link href="/" className={btn("ghost", "sm")}>
          Go to Home
        </Link>
      </div>
      {errorRef ? <div className="text-[12px] text-ink-6">Error ref: {errorRef}</div> : null}
    </div>
  );
}

/** Empty · No search results (DeskStates). */
export function EmptySearch({ query, onSuggest }: { query: string; onSuggest: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-2 py-6 text-center">
      <H2 size={20}>No results for “{query}”</H2>
      <div className="text-[15px] text-ink-4">Try a book title, an author, or a topic.</div>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2">
        {["Money", "Habits", "Morgan Housel"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            className="min-h-9 rounded-full border-0 bg-raised-2 px-3.5 py-2 text-[14px] text-ink hover:bg-line"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mt-1.5 text-[14px] text-ink-4">
        Can’t find a book?{" "}
        <a className="dk-link font-semibold text-coral" href={BOOK_REQUEST_MAILTO}>
          Request it
        </a>
      </div>
    </div>
  );
}

/** Offline banner (DeskStates), shown while navigator.onLine is false. */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <div role="status" className="flex items-center gap-2.5 rounded-xl bg-offline-bg px-3.5 py-3 text-[14px] text-offline-ink">
        <OfflineIcon size={18} className="flex-none" />
        You’re offline. Reconnect to keep watching; your place is saved.
      </div>
      <div className="text-[14px] text-ink-4">
        Want episodes offline?{" "}
        {APP_STORE_URL ? (
          <a className="dk-link font-semibold text-coral" href={APP_STORE_URL}>
            Download them in the mintsy iPhone app.
          </a>
        ) : (
          "Download them in the mintsy iPhone app."
        )}
      </div>
    </div>
  );
}

/** The fake search field at the top of Home / first run (links to Search). */
export function SearchLink() {
  return (
    <Link
      href="/search"
      className="box-border flex h-12 max-w-[560px] flex-1 items-center gap-3 rounded-xl border border-line-2 bg-raised px-4 text-[15px] text-ink-6 hover:border-line-strong"
    >
      <SearchIcon size={18} />
      Search books, authors, topics
    </Link>
  );
}
