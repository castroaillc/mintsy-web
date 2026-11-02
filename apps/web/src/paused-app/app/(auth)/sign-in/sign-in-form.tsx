"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PasswordField, TextField } from "@/components/fields";
import { SocialButtons } from "@/components/social-buttons";
import { btn, ErrorAlert, H1, InfoAlert } from "@/components/ui";
import { authClient, authErrorCode } from "@/lib/auth-client";

const WRONG_PASSWORD = "That email and password don’t match. Try again or reset your password.";

/** Messages for ?error=… from the social sign-in redirect (errorCallbackURL). */
function socialError(code: string | undefined) {
  if (!code) return null;
  if (/OAUTH_LINK_ERROR|unable_to_link_account|account_not_linked/i.test(code)) {
    return "An account with this email already exists. Sign in with your password.";
  }
  if (/email_not_found/i.test(code)) return "We couldn’t get your email address from that account. Try another way to sign in.";
  return "Couldn’t sign you in with that account. Try again.";
}

/** DeskSignIn / DeskSignInError */
export function SignInForm({ next, oauthError, notice }: { next: string; oauthError?: string; notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(socialError(oauthError));
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      const code = authErrorCode(error);
      setError(
        /INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|USER_NOT_FOUND|CREDENTIAL_ACCOUNT_NOT_FOUND/.test(code)
          ? WRONG_PASSWORD
          : /INVALID_EMAIL/.test(code)
            ? "Enter a valid email address."
            : /HTTP_429|TOO_MANY/.test(code)
              ? "Too many attempts. Wait a minute and try again."
              : "Couldn’t sign in. Check your connection and try again.",
      );
      return;
    }
    window.location.assign(next);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <H1>Welcome back</H1>
        <p className="m-0 text-[16px] leading-[1.55] text-ink-4">Sign in to pick up where you left off.</p>
      </div>
      {error ? <ErrorAlert>{error}</ErrorAlert> : notice ? <InfoAlert>{notice}</InfoAlert> : null}
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          labelAside={
            <Link className="dk-link text-[14px] font-semibold text-coral" href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}>
              Forgot password?
            </Link>
          }
        />
        <button type="submit" disabled={busy || !email.trim() || !password} className={btn("primary", "md", "w-full disabled:opacity-60")}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <SocialButtons callbackPath={next} errorPath="/sign-in" onError={setError} />
      <div className="text-center text-[15px] text-ink-4">
        New to mintsy?{" "}
        <Link className="dk-link font-semibold text-coral" href={next === "/" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`}>
          Create account
        </Link>
      </div>
    </>
  );
}
