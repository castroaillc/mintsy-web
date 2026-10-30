/** Public configuration (NEXT_PUBLIC_* is inlined at build time). */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://getmintsy.com").replace(/\/$/, "");

export const PRIVACY_URL = `${SITE_URL}/privacy`;
/** The landing site has no /terms page yet, so Terms points at the privacy policy for now (see README). */
export const TERMS_URL = `${SITE_URL}/privacy`;
export const HELP_CENTER_URL = `${SITE_URL}/support`;

export const SUPPORT_EMAIL = "support@getmintsy.com";
export const FEEDBACK_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("mintsy feedback")}`;
export const BOOK_REQUEST_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Book request")}`;

export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "";
/** Apple's subscriptions page (opens Settings › Subscriptions on Apple devices). */
export const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

export const REVENUECAT_WEB_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY || "";

export type SocialProvider = "apple" | "google";

/** Which social buttons to show. Unset = both; "", "none" = neither. Apple always comes first. */
export function socialProviders(): SocialProvider[] {
  const raw = process.env.NEXT_PUBLIC_SOCIAL_PROVIDERS;
  if (raw === undefined) return ["apple", "google"];
  const listed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return (["apple", "google"] as const).filter((p) => listed.includes(p));
}

export const APP_VERSION = "1.0.0";
