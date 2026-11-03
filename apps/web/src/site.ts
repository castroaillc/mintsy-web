// Values for the public site (landing, privacy, support). Shared URLs and the support email live in lib/config.ts.

export { FREE_EPISODES } from "@/lib/types";

/** Change this whenever the text of the privacy policy changes. */
export const LEGAL_UPDATED = "2 November 2026";

/** The mintsy web app is paused (see paused-app/README.md); null hides every "Watch on the web" link. */
export const WEB_APP_URL: string | null = null;

/** Apple's standard EULA is mintsy's Terms of Use (same as mobile-app/src/lib/legal.ts). */
export const EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

/** Shown in the footer copyright line. */
export const COMPANY_NAME = "mintsy";

/**
 * Real prices come from App Store Connect (the app reads them at runtime, mobile-app/src/lib/offering.ts).
 * null keeps the pricing card free of made-up numbers; fill it in to show the trial badge and prices.
 */
export const PRICING: { trialLength: string; yearly: string; monthly: string } | null = null;
