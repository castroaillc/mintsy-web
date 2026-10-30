"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TextField } from "@/components/fields";
import { MailIcon } from "@/components/icons";
import { btn, ErrorAlert, H1 } from "@/components/ui";
import { absoluteUrl, authClient } from "@/lib/auth-client";

/** Better Auth sends the user to <redirectTo>?token=… (or ?error=INVALID_TOKEN). The email rides along. */
async function sendReset(email: string) {
  const redirect = new URL(absoluteUrl("/reset-password"));
  redirect.searchParams.set("email", email);
  return authClient.requestPasswordReset({ email, redirectTo: redirect.toString() });
}

/** DeskForgot */
export function ForgotForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    const { error } = await sendReset(value);
    setBusy(false);
    if (error) {
      setError(error.status === 429 ? "Too many requests. Wait a minute and try again." : "Couldn’t send the link. Check your connection and try again.");
      return;
    }
    window.location.assign(`/forgot-password/sent?email=${encodeURIComponent(value)}`);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <H1>Reset your password</H1>
        <p className="m-0 text-[16px] leading-[1.55] text-ink-4">
          Enter the email you signed up with and we’ll send you a link to set a new one.
        </p>
      </div>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={busy} className={btn("primary", "md", "w-full disabled:opacity-60")}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <div className="text-center text-[15px] text-ink-4">
        Remembered it?{" "}
        <Link className="dk-link font-semibold text-coral" href="/sign-in">
          Sign in
        </Link>
      </div>
    </>
  );
}

/** DeskCheckEmail */
export function CheckEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    if (!email || state === "sending") return;
    setState("sending");
    const { error } = await sendReset(email);
    setState(error ? "error" : "sent");
  }

  return (
    <>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-hero text-coral">
        <MailIcon size={26} />
      </div>
      <div className="flex flex-col gap-2">
        <H1>Check your email</H1>
        <p className="m-0 text-[16px] leading-[1.55] text-ink-4">
          We sent a reset link to {email ? <b className="font-semibold text-ink">{email}</b> : "your email"}. It expires in 1 hour.
        </p>
      </div>
      <p className="m-0 text-[14px] leading-[1.5] text-ink-5">
        Don’t see it? Check spam, or make sure you used the email you signed up with.
      </p>
      <button
        type="button"
        onClick={resend}
        disabled={!email}
        aria-live="polite"
        className={`dk-ghost h-12 rounded-xl border border-line-3 bg-transparent text-[15px] font-semibold ${state === "sent" ? "text-info" : state === "error" ? "text-error-icon" : "text-ink"}`}
      >
        {state === "sent" ? "Sent. Check your inbox" : state === "sending" ? "Sending…" : state === "error" ? "Couldn’t resend. Try again" : "Resend link"}
      </button>
      <div className="text-center text-[15px] text-ink-4">
        <Link className="dk-link font-semibold text-coral" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    </>
  );
}
