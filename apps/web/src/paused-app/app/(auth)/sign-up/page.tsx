import type { Metadata } from "next";
import { RedirectIfSignedIn } from "@/components/redirect-if-signed-in";
import { safeNext } from "@/lib/next-path";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  return (
    <>
      <RedirectIfSignedIn />
      <SignUpForm next={safeNext(next)} />
    </>
  );
}
