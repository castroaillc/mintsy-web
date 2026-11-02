import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SITE_URL } from "@/lib/config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const grotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "mintsy",
  description: "Every great book, one 5-minute episode at a time. Watch books as short video series, with a transcript for every episode.",
  applicationName: "mintsy",
  openGraph: { siteName: "mintsy", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0E0D18",
  colorScheme: "dark",
};

/** The public site: landing, privacy and support. The web app's own root layout is in paused-app/app/layout.tsx. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        <div className="lp">
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
