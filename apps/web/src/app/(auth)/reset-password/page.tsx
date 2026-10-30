import type { Metadata } from "next";
import { firstParam } from "@/lib/next-path";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

/** Better Auth redirects to /reset-password/?token=… (trailing slash); next.config skips the slash redirect. */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  return (
    <ResetForm
      token={firstParam(params.token) ?? null}
      email={firstParam(params.email) ?? null}
      invalid={firstParam(params.error) === "INVALID_TOKEN"}
    />
  );
}
