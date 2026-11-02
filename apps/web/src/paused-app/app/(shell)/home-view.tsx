"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookGrid, BookTile, Cover } from "@/components/cover";
import { CheckIcon, PlayIcon, PlusIcon } from "@/components/icons";
import { useRequireAuth } from "@/components/require-auth";
import { ErrorState, HomeSkeleton, SearchLink } from "@/components/states";
import { btn, Eyebrow, H1, H2, pillClass, SectionHeader } from "@/components/ui";
import { errorCode } from "@/lib/graphql";
import { useCatalog, useContinue, useSaved, useViewer } from "@/lib/data";
import { clock, firstName, minutesEach, minutesLeft } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { resumeFromEntry } from "@/lib/resume";
import { CATEGORIES, CATEGORY_FILTERS, type Book, type CategoryFilter, type EpisodeProgress } from "@/lib/types";

/** DeskHome, and DeskHomeFirstRun while continueWatching is empty. */
export function HomeView() {
  const { ready } = useRequireAuth("welcome");
  const { userId, user, me, isPremium } = useViewer();
  const catalog = useCatalog();
  const cont = useContinue(ready);
  const [prefs] = usePrefs(userId);

  if (!ready || (catalog.isLoading && !catalog.data) || (cont.isLoading && !cont.data)) {
    return (
      <div className="dk-pad">
        <HomeSkeleton />
      </div>
    );
  }
  if (catalog.error && !catalog.data) {
    return (
      <div className="dk-pad">
        <ErrorState title="Couldn’t load mintsy" onRetry={() => catalog.mutate()} errorRef={errorCode(catalog.error)} />
      </div>
    );
  }

  const books = catalog.books.filter((b) => b.episodes.length > 0);
  if (!books.length) {
    return (
      <div className="dk-pad flex flex-col gap-6">
        <SearchLink />
        <H1>Nothing to watch yet</H1>
        <p className="m-0 text-[16px] text-ink-4">New series are on their way. Check back soon.</p>
      </div>
    );
  }

  const name = firstName(me?.name || user?.name);
  return cont.entries.length ? (
    <Regular books={books} entries={cont.entries} interests={prefs.interests} />
  ) : (
    <FirstRun books={books} name={name} interests={prefs.interests} firstSeriesId={prefs.firstSeriesId} isPremium={isPremium} />
  );
}

/** Category rows in the order the viewer's onboarding interests give ("Because you picked Finance"). */
function categoryRows(books: Book[], interests: string[], only?: string) {
  const cats = [...CATEGORIES].filter((c) => books.some((b) => b.category === c));
  const picked = interests.filter((i) => cats.includes(i as (typeof CATEGORIES)[number]));
  const ordered = [...picked, ...cats.filter((c) => !picked.includes(c))];
  return ordered
    .filter((c) => !only || c === only)
    .map((c) => ({
      category: c,
      title: picked.includes(c) ? `Because you picked ${c}` : `Top in ${c}`,
      books: books.filter((b) => b.category === c),
    }));
}

function Regular({ books, entries, interests }: { books: Book[]; entries: EpisodeProgress[]; interests: string[] }) {
  const [cat, setCat] = useState<CategoryFilter>("All");
  const featured = books[0];
  const only = cat === "All" ? undefined : cat;
  const rows = useMemo(() => categoryRows(books, interests, only), [books, interests, only]);
  const recent = useMemo(() => [...books].reverse().filter((b) => !only || b.category === only), [books, only]);
  const chips = CATEGORY_FILTERS.filter((c) => c === "All" || books.some((b) => b.category === c));

  return (
    <div className="dk-pad flex flex-col gap-10">
      <div className="flex items-center gap-4">
        <SearchLink />
      </div>
      <FeaturedHero book={featured} entry={entries.find((e) => e.bookId === featured.id)} />
      <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={pillClass(cat === c, "lg")}>
            {c}
          </button>
        ))}
      </div>
      <section className="flex flex-col gap-4">
        <SectionHeader title="Continue watching" href="/my-list?tab=progress" />
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))" }}>
          {entries.slice(0, 6).map((e) => {
            const book = books.find((b) => b.id === e.bookId);
            return book ? <ContinueCard key={e.episodeId} entry={e} book={book} /> : null;
          })}
        </div>
      </section>
      {rows.map((r) => (
        <section key={r.category} className="flex flex-col gap-4">
          <SectionHeader title={r.title} href={`/category/${r.category}`} />
          <BookGrid>
            {r.books.slice(0, only ? undefined : 6).map((b) => (
              <BookTile key={b.id} book={b} />
            ))}
          </BookGrid>
        </section>
      ))}
      {recent.length ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Recently added" href={`/category/${only ?? "all"}?sort=newest`} />
          <BookGrid>
            {recent.slice(0, 6).map((b) => (
              <BookTile key={b.id} book={b} />
            ))}
          </BookGrid>
        </section>
      ) : null}
    </div>
  );
}

function FeaturedHero({ book, entry }: { book: Book; entry?: EpisodeProgress }) {
  const saved = useSaved();
  const isSaved = saved.isSaved("BOOK", book.id);
  const resume = resumeFromEntry(book, entry);
  const n = resume?.episode.number ?? 1;
  const label = resume?.kind === "in-progress" ? `Resume Episode ${n}` : `Play Episode ${n}`;
  return (
    <section className="flex flex-wrap overflow-hidden rounded-[22px] border border-line bg-card">
      <div className="flex min-w-0 flex-[1_1_340px] items-center justify-center px-6 py-10" style={{ background: book.tint }}>
        <Link href={`/book/${book.id}`} className="w-[190px]" aria-label={book.title} tabIndex={-1}>
          <Cover book={book} titleSize={22} authorSize={15} padding={16} />
        </Link>
      </div>
      <div className="box-border flex min-w-0 flex-[1.4_1_420px] flex-col justify-center gap-4 p-10 @max-[520px]:p-6">
        <Eyebrow className="text-coral">Featured series</Eyebrow>
        <H1 size={40}>
          <Link href={`/book/${book.id}`} className="hover:underline">
            {book.title}
          </Link>
        </H1>
        <div className="text-[15px] text-ink-4">
          {book.author} · {book.episodes.length} episodes · {minutesEach(book)} min each
        </div>
        <p className="m-0 max-w-[560px] text-[16px] leading-[1.6] text-ink-3">{book.description}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href={`/book/${book.id}/${n}`} className={btn("primary")}>
            <PlayIcon size={16} />
            {label}
          </Link>
          <button type="button" aria-pressed={isSaved} onClick={() => saved.toggle("BOOK", book.id)} className={btn("ghost")}>
            {isSaved ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
            My List
          </button>
        </div>
      </div>
    </section>
  );
}

function ContinueCard({ entry, book }: { entry: EpisodeProgress; book: Book }) {
  const ep = book.episodes.find((e) => e.number === entry.episodeNumber);
  const locked = entry.episode?.locked ?? ep?.locked ?? false;
  const title = entry.episode?.title ?? ep?.title ?? "";
  const thumb = entry.episode?.thumbnailUrl ?? ep?.thumbnailUrl ?? null;
  const fraction = entry.durationSec ? entry.positionSec / entry.durationSec : 0;
  return (
    <Link href={`/book/${book.id}/${entry.episodeNumber}`} className="dk-card flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
      <div
        className="relative box-border flex aspect-video flex-col justify-between p-4"
        style={{
          backgroundColor: book.tint,
          color: "#F4EFE6",
          backgroundImage: thumb ? `linear-gradient(rgba(14,13,24,0.35), rgba(14,13,24,0.55)), url("${thumb}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="font-display text-[13px] font-bold tracking-[1px]">EP. {entry.episodeNumber}</div>
        <div className="flex items-end justify-between gap-3">
          <div className="font-display text-[20px] font-bold leading-[1.1]">{title}</div>
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[rgba(14,13,24,0.6)] text-white">
            {locked ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            ) : (
              <PlayIcon size={14} />
            )}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[rgba(255,255,255,0.18)]">
          <div className="h-1 bg-coral" style={{ width: `${Math.round(Math.min(1, fraction) * 100)}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 px-4 pb-4 pt-3">
        <div className="text-[14px] font-semibold">{book.title}</div>
        <div className="text-[13px] text-ink-5">
          Episode {entry.episodeNumber} of {book.episodes.length} · {locked ? "Premium" : entry.positionSec > 0 ? minutesLeft(entry) : "Up next"}
        </div>
      </div>
    </Link>
  );
}

function FirstRun({
  books,
  name,
  interests,
  firstSeriesId,
  isPremium,
}: {
  books: Book[];
  name: string;
  interests: string[];
  firstSeriesId: string | null;
  isPremium: boolean;
}) {
  const picked = firstSeriesId ? books.find((b) => b.id === firstSeriesId) : undefined;
  const book = picked ?? books[0];
  const ep1 = [...book.episodes].sort((a, b) => a.number - b.number)[0];
  const rows = categoryRows(books, interests)
    .map((r) => ({ ...r, books: r.books.filter((b) => b.id !== book.id) }))
    .filter((r) => r.books.length);
  return (
    <div className="dk-pad flex flex-col gap-10">
      <div className="flex items-center gap-4">
        <SearchLink />
      </div>
      <div className="flex flex-col gap-1.5">
        {name ? <div className="text-[15px] text-ink-4">Welcome, {name}</div> : null}
        <H1 size={36}>Start your first series</H1>
      </div>
      <section className="box-border flex min-w-0 flex-wrap items-center gap-8 rounded-[22px] p-8 @max-[520px]:p-6" style={{ background: book.tint }}>
        <Link href={`/book/${book.id}`} className="w-[150px] flex-none" aria-label={book.title} tabIndex={-1}>
          <Cover book={book} titleSize={19} authorSize={12} />
        </Link>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3">
          <Eyebrow className="text-coral-hover">{picked ? "Your pick from onboarding" : "Featured series"}</Eyebrow>
          <H2 size={28}>
            <Link href={`/book/${book.id}`} className="hover:underline">
              {book.title}
            </Link>
          </H2>
          <div className="text-[15px] text-ink-3">
            {book.author} · {book.episodes.length} episodes · {minutesEach(book)} min each
          </div>
          {ep1 ? (
            <div className="rounded-xl bg-[rgba(14,13,24,0.45)] px-4 py-3.5 text-[14px] leading-[1.5]">
              <b className="font-semibold">
                Episode 1 of {book.episodes.length} · {ep1.title}
              </b>
              <br />
              <span className="text-ink-3">
                {clock(ep1.durationSec)}
                {isPremium ? "" : " · Free"}
              </span>
            </div>
          ) : null}
          <div>
            <Link href={`/book/${book.id}/1`} className={btn("primary")}>
              <PlayIcon size={16} />
              Start Episode 1
            </Link>
          </div>
        </div>
      </section>
      {rows.map((r) => (
        <section key={r.category} className="flex flex-col gap-4">
          <SectionHeader title={r.title} href={`/category/${r.category}`} />
          <BookGrid>
            {r.books.slice(0, 6).map((b) => (
              <BookTile key={b.id} book={b} />
            ))}
          </BookGrid>
        </section>
      ))}
    </div>
  );
}

