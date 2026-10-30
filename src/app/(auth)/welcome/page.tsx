import type { Metadata } from "next";
import Link from "next/link";
import { RedirectIfSignedIn } from "@/components/redirect-if-signed-in";
import { btn, H1 } from "@/components/ui";
import { PRIVACY_URL, TERMS_URL } from "@/lib/config";

export const metadata: Metadata = { title: "Welcome" };

/** DeskWelcome */
export default function WelcomePage() {
  return (
    <>
      <RedirectIfSignedIn />
      <div className="flex flex-col gap-2">
        <H1>Welcome to mintsy</H1>
        <p className="m-0 text-[16px] leading-[1.55] text-ink-4">
          Every great book, one 5-minute episode at a time. Create an account to save your place in every series.
        </p>
      </div>
      <Link href="/sign-up" className={btn("primary", "md", "w-full")}>
        Create account
      </Link>
      <Link href="/sign-in" className={btn("ghost", "md", "w-full")}>
        Sign in
      </Link>
      <p className="m-0 text-center text-[13px] leading-[1.5] text-ink-5">
        By continuing you agree to our{" "}
        <a className="dk-link underline" href={TERMS_URL}>
          Terms
        </a>{" "}
        and{" "}
        <a className="dk-link underline" href={PRIVACY_URL}>
          Privacy Policy
        </a>
        .
      </p>
    </>
  );
}
