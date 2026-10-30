import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { BackIcon } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "ghost" | "light";
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  sm: "h-10 px-5 text-[14px]",
  md: "h-12 px-5 text-[15px]",
  lg: "h-[52px] px-7 text-[16px]",
};

const VARIANT: Record<Variant, string> = {
  primary: "dk-btn bg-coral text-on-coral border-0",
  ghost: "dk-ghost bg-transparent text-ink border border-line-3",
  light: "dk-light bg-ink text-on-coral border-0",
};

/** Button styles from the boards: coral (dk-btn), outlined (dk-ghost) and light. */
export function btn(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "box-border inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap",
    "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed",
    SIZE[size],
    VARIANT[variant],
    extra,
  );
}

/** The disabled coral button (onboarding "Pick 2 more", delete account before confirming). */
export const BTN_DISABLED = "!bg-line !text-ink-5 pointer-events-none";

/** Round pill toggles (category chips, filters, sorts): light when on. */
export function pillClass(on: boolean, size: "sm" | "md" | "lg" = "md") {
  const h = size === "sm" ? "h-9 px-[14px] text-[13px]" : size === "md" ? "h-[38px] px-4 text-[14px]" : "h-10 px-[18px] text-[14px]";
  return cx(
    "rounded-full border font-semibold transition-colors",
    h,
    on ? "border-ink bg-ink text-on-coral" : "border-line-2 bg-raised text-ink-2 hover:border-line-strong",
  );
}

/** Coral-tinted multi-select chips (interests, daily goal). */
export function choiceChipClass(on: boolean) {
  return cx(
    "h-11 rounded-full border px-[18px] text-[15px] font-semibold",
    on ? "border-coral bg-[rgba(255,107,87,0.14)] text-ink" : "border-line-2 bg-raised text-ink-2 hover:border-line-strong",
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="dk-link inline-flex min-h-11 items-center gap-1.5 self-start text-[14px] font-semibold text-ink-4"
    >
      <BackIcon size={18} />
      {children}
    </Link>
  );
}

export function H1({ className, size = 34, ...rest }: ComponentProps<"h1"> & { size?: number }) {
  return (
    <h1
      className={cx("m-0 font-display font-bold leading-[1.05] tracking-[-0.02em] text-balance", className)}
      style={{ fontSize: size }}
      {...rest}
    />
  );
}

export function H2({ className, size = 22, ...rest }: ComponentProps<"h2"> & { size?: number }) {
  return <h2 className={cx("m-0 font-display font-bold leading-[1.15]", className)} style={{ fontSize: size }} {...rest} />;
}

export function Eyebrow({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("text-[12px] font-semibold uppercase tracking-[1.2px]", className)} {...rest} />;
}

export function SectionHeader({ title, href, linkLabel = "See all" }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <H2>{title}</H2>
      {href ? (
        <Link href={href} className="dk-link text-[14px] font-semibold text-ink-4">
          {linkLabel}
          <span className="sr-only">: {title}</span>
        </Link>
      ) : null}
    </div>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="font-display font-bold leading-none tracking-[-0.03em]" style={{ fontSize: size }}>
      mintsy<span className="text-coral">.</span>
    </span>
  );
}

/** Small inline alert from DeskSignInError. */
export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-xl border border-upsell-line bg-error-bg p-3.5 text-[14px] leading-[1.45] text-error-ink">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB4AE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
        <path d="M12 4l9 16H3zM12 10v4M12 17h.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/** Neutral notice in the same shape (success messages on auth pages). */
export function InfoAlert({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex gap-2.5 rounded-xl border border-line bg-raised p-3.5 text-[14px] leading-[1.45] text-ink-2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8FD3FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
        <path d="M5 12l5 5L20 7" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
