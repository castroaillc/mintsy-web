"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCatalog, useContinue, useViewer } from "@/lib/data";
import { firstName, initials, planName } from "@/lib/format";
import { HomeIcon, BookmarkIcon, PlayIcon, ProfileIcon, SearchIcon } from "./icons";
import { OfflineBanner } from "./states";
import { ToastOutlet } from "./toast";
import { btn, Logo } from "./ui";

const NAV = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/search", label: "Search", Icon: SearchIcon },
  { href: "/my-list", label: "My List", Icon: BookmarkIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
] as const;

/** Which nav item a path belongs to (series, player and category pages sit under Home, as in the boards). */
function section(pathname: string) {
  if (pathname.startsWith("/search")) return "/search";
  if (pathname.startsWith("/my-list")) return "/my-list";
  if (pathname.startsWith("/profile")) return "/profile";
  return "/";
}

/** Side nav (248px) that becomes a top bar below 860px, from the Desktop boards. */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = section(pathname);

  return (
    <div className="dk-shell">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-on-coral">
        Skip to content
      </a>
      <nav className="dk-nav" aria-label="Main">
        <Link href="/" aria-label="mintsy home" className="px-3 py-1">
          <Logo size={26} />
        </Link>
        <div className="dk-navlist">
          {NAV.map(({ href, label, Icon }) => {
            const on = current === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                aria-label={label}
                className={`dk-navitem flex h-11 min-w-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-semibold ${on ? "bg-raised-2 text-ink" : "bg-transparent text-ink-4"}`}
              >
                <Icon size={20} className={on ? "text-coral" : undefined} />
                <span className="dk-navlabel">{label}</span>
              </Link>
            );
          })}
        </div>
        <NavFooter />
      </nav>
      <main id="main" className="dk-main" tabIndex={-1}>
        <OfflineBanner className="px-12 pt-6 @max-[860px]:px-5 @max-[520px]:px-4" />
        {children}
        <ToastOutlet />
      </main>
    </div>
  );
}

function NavFooter() {
  const { user, pending, premium, isPremium, me } = useViewer();
  const { entries } = useContinue(!!user && isPremium);
  const { books } = useCatalog();

  if (pending) return <div className="dk-hide-sm mt-auto" />;

  if (!user) {
    return (
      <div className="dk-hide-sm mt-auto flex flex-col gap-4">
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-card p-4">
          <div className="text-[14px] font-semibold">Save your place</div>
          <div className="text-[13px] leading-[1.45] text-ink-3">Create a free account to pick up every series where you left off.</div>
          <Link href="/sign-up" className={btn("primary", "sm", "w-full !text-[14px]")}>
            Create account
          </Link>
          <Link href="/sign-in" className="dk-link self-center text-[14px] font-semibold text-ink-4">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const name = me?.name || user.name || "";
  const plan = isPremium ? ["Premium", planName(premium?.productId)].filter(Boolean).join(" · ") : "Free plan";
  const next = entries[0];
  const nextBook = next ? books.find((b) => b.id === next.bookId) : undefined;

  return (
    <div className="dk-hide-sm mt-auto flex flex-col gap-4">
      {!isPremium ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-upsell-line bg-upsell p-4">
          <div className="text-[14px] font-semibold">Unlock every episode</div>
          <div className="text-[13px] leading-[1.45] text-ink-3">The first 3 episodes of every book are free.</div>
          <Link href="/premium" className={btn("primary", "sm", "w-full !text-[14px]")}>
            Try Premium
          </Link>
        </div>
      ) : next ? (
        <Link
          href={`/book/${next.bookId}/${next.episodeNumber}`}
          className="dk-card flex items-center gap-3 rounded-[14px] border border-line bg-card p-3"
        >
          <div
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-ink"
            style={{ background: nextBook?.tint ?? "#2B2850" }}
          >
            <PlayIcon size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-coral">
              Continue · Episode {next.episodeNumber}
              {nextBook ? ` of ${nextBook.episodes.length}` : ""}
            </div>
            <div className="truncate text-[13px] font-semibold">{next.episode?.title ?? nextBook?.title}</div>
          </div>
        </Link>
      ) : null}
      <Link href="/profile" className="dk-navitem flex items-center gap-3 rounded-xl px-2.5 py-2">
        <div className="box-border flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-coral font-display font-bold">
          {initials(firstName(name) || name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold">{firstName(name) || "Your profile"}</div>
          <div className="text-[12px] text-ink-5">{plan}</div>
        </div>
      </Link>
    </div>
  );
}
