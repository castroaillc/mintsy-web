import { APP_STORE_URL } from "@/lib/config";
import { WEB_APP_URL } from "@/site";

const badge = "inline-flex h-14 items-center gap-2.5 rounded-xl bg-black px-5 text-[15px] font-semibold text-fg";

/** Drawn App Store button; swap for Apple's official badge artwork when the listing is live. Without a URL it isn't a link. */
export function AppStoreBadge({ bordered = true }: { bordered?: boolean }) {
  const border = bordered ? " border border-ring" : "";
  if (!APP_STORE_URL) return <span className={badge + border}>App Store: coming soon</span>;
  return (
    <a href={APP_STORE_URL} className={`${badge}${border} hover:bg-secondary`}>
      Download on the App Store
    </a>
  );
}

/** "Watch on the web"; renders nothing while WEB_APP_URL is null. */
export function WebAppButton({ tone = "dark" }: { tone?: "dark" | "brand" }) {
  if (!WEB_APP_URL) return null;
  const colors = tone === "brand" ? "border-brand-fg text-brand-fg" : "border-border-strong text-fg hover:border-ring";
  return (
    <a href={WEB_APP_URL} className={`inline-flex h-14 items-center rounded-xl border px-5 text-[15px] font-semibold ${colors}`}>
      Watch on the web
    </a>
  );
}
