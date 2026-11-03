import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import favicon from "@mintsy/brand/assets/icons/ink-coral/favicon.png";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const mono = JetBrains_Mono({ variable: "--font-mono-family", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "mintsy admin", template: "%s · mintsy admin" },
  description: "Local content dashboard for mintsy",
  icons: { icon: favicon.src },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <Nav db={env.mongodbDb} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
          <Toaster theme="dark" position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
