/**
 * What the root layout waits for at launch. Pure, so scripts/launch.test.mjs can check every launch path under plain
 * Node.
 *
 * - Every launch waits for the session's first answer, the theme, the fonts and the read of the catalog saved on the
 *   device (milliseconds; it lets Welcome's covers and Home start from the saved copy rather than flash placeholders).
 * - Signed out (a fresh install, or after signing out): nothing else. Welcome and the other auth screens don't need the
 *   catalog, which keeps loading behind them. Signed out is known from the device when it has no session cookie
 *   (`useLaunchSession`), with no network round trip.
 * - Signed in: also the onboarding flag, so no auth or onboarding screen flashes. Never the network: without a saved
 *   catalog, the screens show their loading state.
 * - "Couldn't load mintsy" only shows when a signed-in viewer has no catalog at all (none fetched, none cached) and no
 *   downloads to fall back on.
 * - Time to interactive: the splash is down, a real screen is up, and it has its data. For a signed-in viewer that
 *   means the catalog is out of its loading state (cached or fetched, or failed with downloads to watch).
 */

export type CatalogStatus = 'loading' | 'ready' | 'error';

export type LaunchInputs = {
  /** The first session answer is in (from the device or the API). */
  sessionKnown: boolean;
  signedIn: boolean;
  themeLoaded: boolean;
  /** Loaded, or failed (system fonts are used then). */
  fontsReady: boolean;
  /** The signed-in user's onboarding answers are loaded. */
  onboardingLoaded: boolean;
  catalogStatus: CatalogStatus;
  /** The catalog cache on the device has been read (whether or not it was usable). */
  catalogDeviceChecked: boolean;
  catalogHasBooks: boolean;
  hasDownloads: boolean;
};

export type LaunchGate = {
  /** Hide the splash screen and render the navigator (or the error screen). */
  show: boolean;
  /** Show "Couldn't load mintsy" instead of the navigator. */
  catalogError: boolean;
  /** Report time to interactive. */
  interactive: boolean;
};

export function launchGate(i: LaunchInputs): LaunchGate {
  const basics = i.sessionKnown && i.themeLoaded && i.fontsReady && i.catalogDeviceChecked;
  if (!i.signedIn) return { show: basics, catalogError: false, interactive: basics };

  const show = basics && i.onboardingLoaded;
  const catalogError = i.catalogStatus === 'error' && !i.catalogHasBooks && !i.hasDownloads;
  const interactive = show && !catalogError && i.catalogStatus !== 'loading';
  return { show, catalogError, interactive };
}
