import Link from "next/link";
import { logoPaths } from "@mintsy/brand";
import { APP_STORE_URL } from "@/lib/config";
import { COMPANY_NAME, EULA_URL } from "@/site";

function Wordmark({ size }: { size: number }) {
  const { width, height, letters, dot } = logoPaths.wordmark;
  // The outlines are in 1000-unit em squares, so `size` matches a font size.
  return (
    <span className="inline-flex items-center align-top" style={{ height: size + 2 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={(size * width) / 1000} height={(size * height) / 1000} role="img" aria-label="mintsy">
        <path d={letters} className="fill-fg" />
        <path d={dot} className="fill-brand" />
      </svg>
    </span>
  );
}

const navlink = "hover:text-fg";

export function SiteHeader() {
  return (
    <header className="relative z-[2] mx-auto box-border flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-6 py-[22px]">
      <Link href="/" aria-label="mintsy home">
        <Wordmark size={28} />
      </Link>
      <nav aria-label="Main" className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[15px] font-medium text-muted">
        <Link className={navlink} href="/#how">
          How it works
        </Link>
        <Link className={navlink} href="/#duo">
          iPhone Duo
        </Link>
        <Link className={navlink} href="/#pricing">
          Pricing
        </Link>
        <Link className={navlink} href="/#faq">
          FAQ
        </Link>
        {APP_STORE_URL ? (
          <a href={APP_STORE_URL} className="inline-flex h-[42px] items-center rounded-xl bg-brand px-[18px] font-semibold text-brand-fg hover:bg-brand-hover">
            Get the app
          </a>
        ) : null}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto box-border flex max-w-[1240px] flex-wrap justify-between gap-x-10 gap-y-5 px-6 pt-9 pb-11 text-sm text-faint">
        <div className="flex flex-col gap-2.5">
          <Wordmark size={22} />
          <div>
            © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-7 gap-y-2.5">
          <Link className={navlink} href="/privacy">
            Privacy
          </Link>
          <a className={navlink} href={EULA_URL}>
            Terms
          </a>
          <Link className={navlink} href="/support">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
