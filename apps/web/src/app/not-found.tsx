import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found · mintsy", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto box-border flex max-w-[820px] flex-col items-start gap-4 px-6 pt-20 pb-32">
      <h1 className="h2 m-0 font-display leading-[1.05] font-bold tracking-[-0.02em]">Page not found</h1>
      <p className="m-0 text-lg leading-[1.55] text-body">This page doesn’t exist.</p>
      <Link href="/" className="font-semibold text-brand underline underline-offset-2 hover:text-brand-hover">
        Go to the mintsy home page
      </Link>
    </div>
  );
}
