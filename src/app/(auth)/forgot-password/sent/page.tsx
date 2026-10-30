import type { Metadata } from "next";
import { firstParam } from "@/lib/next-path";
import { CheckEmail } from "../forms";

export const metadata: Metadata = { title: "Check your email" };

export default async function SentPage({ searchParams }: PageProps<"/forgot-password/sent">) {
  const { email } = await searchParams;
  return <CheckEmail email={firstParam(email) ?? ""} />;
}
