import type { Metadata } from "next";
import { RedirectIfSignedIn } from "@/components/redirect-if-signed-in";
import { firstParam, safeNext } from "@/lib/next-path";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  reset: "Your password was changed. Sign in with the new one.",
  deleted: "Your account was deleted.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const notice = NOTICES[firstParam(params.notice) ?? ""];
  return (
    <>
      <RedirectIfSignedIn to={next} />
      <SignInForm next={next} oauthError={firstParam(params.error)} notice={notice} />
    </>
  );
}
