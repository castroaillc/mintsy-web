"use client";

import { useState } from "react";
import { absoluteUrl, authClient } from "@/lib/auth-client";
import { socialProviders, type SocialProvider } from "@/lib/config";
import { AppleLogo, GoogleLogo } from "./icons";
import { btn } from "./ui";

const LABEL: Record<SocialProvider, string> = { apple: "Continue with Apple", google: "Continue with Google" };

/**
 * Sign in with Apple / Google (Better Auth browser redirect flow). Apple first. Not on the boards: they're
 * styled as the boards' outlined buttons. Hidden when NEXT_PUBLIC_SOCIAL_PROVIDERS doesn't list them.
 */
export function SocialButtons({
  callbackPath = "/",
  newUserPath = "/onboarding/interests",
  errorPath = "/sign-in",
  onError,
}: {
  callbackPath?: string;
  newUserPath?: string;
  errorPath?: string;
  onError?: (message: string) => void;
}) {
  const providers = socialProviders();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  if (!providers.length) return null;

  async function go(provider: SocialProvider) {
    setBusy(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: absoluteUrl(callbackPath),
      newUserCallbackURL: absoluteUrl(newUserPath),
      errorCallbackURL: absoluteUrl(errorPath),
    });
    if (error) {
      setBusy(null);
      onError?.(`Couldn’t start ${provider === "apple" ? "Apple" : "Google"} sign-in. Try again.`);
    }
    // On success the browser is already on its way to the provider
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[13px] text-ink-5" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      {providers.map((p) => (
        <button key={p} type="button" onClick={() => go(p)} disabled={!!busy} className={btn("ghost", "md", "w-full")}>
          {p === "apple" ? <AppleLogo /> : <GoogleLogo />}
          {busy === p ? "Opening…" : LABEL[p]}
        </button>
      ))}
    </div>
  );
}
