"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Books", match: (p: string) => p === "/" || p.startsWith("/books") },
  { href: "/jobs", label: "Jobs", match: (p: string) => p.startsWith("/jobs") },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
          <span className="inline-block size-2.5 rounded-full bg-brand" aria-hidden />
          mintsy <span className="font-medium text-muted-foreground">admin</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
                l.match(pathname) && "bg-muted text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto hidden text-xs text-faint sm:block">Local only · Publish goes live in the app immediately</span>
      </div>
    </header>
  );
}
