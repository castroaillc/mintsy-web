"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/fields";
import { btn, ErrorAlert, H1 } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

/**
 * DeskResetPassword. Better Auth lands here as /reset-password/?token=… or ?error=INVALID_TOKEN. A reset
 * revokes every session, so "Save and sign in" signs in again with the new password when the email is known.
 */
export function ResetForm({ token, email, invalid }: { token: string | null; email: string | null; invalid: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(
    invalid || !token ? "This reset link is invalid or has expired. Send a new one to try again." : null,
  );
  const [busy, setBusy] = useState(false);
  const dead = invalid || !token;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (dead || !token) return;
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords don’t match.");
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setBusy(false);
      setError(/INVALID_TOKEN/.test(error.code ?? "") ? "This reset link is invalid or has expired. Send a new one to try again." : "Couldn’t save your new password. Try again.");
      return;
    }
    if (email) {
      const signIn = await authClient.signIn.email({ email, password });
      if (!signIn.error) {
        window.location.assign("/");
        return;
      }
    }
    window.location.assign("/sign-in?notice=reset");
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <H1>Set a new password</H1>
        <p className="m-0 text-[16px] leading-[1.55] text-ink-4">
          {email ? `For ${email}. ` : ""}You’ll stay signed in on this browser.
        </p>
      </div>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <PasswordField
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters"
          shown={shown}
          onToggle={() => setShown((s) => !s)}
          disabled={dead}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          shown={shown}
          onToggle={() => setShown((s) => !s)}
          disabled={dead}
        />
        <button type="submit" disabled={busy || dead} className={btn("primary", "md", "w-full disabled:opacity-60")}>
          {busy ? "Saving…" : "Save and sign in"}
        </button>
      </form>
      <div className="text-center text-[15px] text-ink-4">
        This link expired?{" "}
        <Link className="dk-link font-semibold text-coral" href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}>
          Send a new one
        </Link>
      </div>
    </>
  );
}
