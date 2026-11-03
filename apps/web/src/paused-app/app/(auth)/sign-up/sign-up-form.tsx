"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PasswordField, TextField } from "@/components/fields";
import { SocialButtons } from "@/components/social-buttons";
import { btn, ErrorAlert, H1 } from "@/components/ui";
import { authClient, authErrorCode } from "@/lib/auth-client";

/** DeskSignUp */
export function SignUpForm({ next }: { next: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    const { error } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
    if (error) {
      setBusy(false);
      const code = authErrorCode(error);
      setError(
        /USER_ALREADY_EXISTS/.test(code)
          ? "An account with this email already exists. Sign in instead."
          : /PASSWORD_TOO_SHORT/.test(code)
            ? "Use at least 8 characters for your password."
            : /INVALID_EMAIL/.test(code)
              ? "Enter a valid email address."
              : "Couldn’t create your account. Try again.",
      );
      return;
    }
    // Full navigation: every per-user cache starts fresh for the new account
    window.location.assign(next === "/" ? "/onboarding/interests" : next);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <H1>Create account</H1>
        <p className="m-0 text-[16px] leading-[1.55] text-ink-4">It only takes a minute.</p>
      </div>
      {error ? (
        <ErrorAlert>
          {error}
          {/already exists/.test(error) ? (
            <>
              {" "}
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-semibold text-coral underline">
                Sign in
              </Link>
            </>
          ) : null}
        </ErrorAlert>
      ) : null}
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <TextField label="Name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Use at least 8 characters."
        />
        <button type="submit" disabled={busy || !name.trim() || !email.trim() || !password} className={btn("primary", "md", "w-full disabled:opacity-60")}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <SocialButtons callbackPath={next} newUserPath="/onboarding/interests" errorPath="/sign-up" onError={setError} />
      <div className="text-center text-[15px] text-ink-4">
        Already have an account?{" "}
        <Link className="dk-link font-semibold text-coral" href={next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`}>
          Sign in
        </Link>
      </div>
    </>
  );
}
