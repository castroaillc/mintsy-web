import type { Metadata } from "next";
import { firstParam } from "@/lib/next-path";
import { ForgotForm } from "./forms";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPage({ searchParams }: PageProps<"/forgot-password">) {
  const { email } = await searchParams;
  return <ForgotForm initialEmail={firstParam(email) ?? ""} />;
}
