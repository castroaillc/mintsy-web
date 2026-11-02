import type { ReactNode } from "react";

export const legalH1 = "m-0 mb-3 font-display text-[40px] leading-[1.05] font-bold tracking-[-0.02em]";

/** Reading column for the privacy and support pages. */
export function LegalPage({ children }: { children: ReactNode }) {
  return <div className="prose-mintsy mx-auto box-border max-w-[820px] px-6 pt-10 pb-24">{children}</div>;
}
