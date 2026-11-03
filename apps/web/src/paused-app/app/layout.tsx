import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://app.getmintsy.com"),
  title: { default: "mintsy", template: "%s · mintsy" },
  description: "Every great book, one 5-minute episode at a time. Watch books as short video series, with a transcript for every episode.",
  applicationName: "mintsy",
  openGraph: { siteName: "mintsy", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0E0D18",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        <Providers>
          <div className="dk">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
