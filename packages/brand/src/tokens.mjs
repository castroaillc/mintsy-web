// @mintsy/brand: the single source of truth for mintsy's brand.
// Edit this file, then run `npm run build` to regenerate dist/ and css/.
// Colors are hex here; the build turns them into each platform's format.

export const brand = {
  name: 'mintsy',
  wordmark: 'mintsy.',
  tagline: 'Books, as 5-minute video series',
  description:
    'mintsy turns every chapter of a book into a short video episode with a full transcript.',
  domain: 'getmintsy.com',
  url: 'https://getmintsy.com',
  supportEmail: 'support@getmintsy.com',
  appScheme: 'mintsy',
};

export const defaultTheme = 'ink-coral';
export const defaultMode = 'dark';

/**
 * Semantic colors per theme and mode. Token names match the mobile app
 * (src/global.css) and shadcn/ui. One difference by platform, kept on purpose:
 * - Native (gluestack): `primary` is the neutral strong color (white in dark mode).
 * - Web (shadcn): `--primary` is the brand color, so default buttons are coral.
 */
const lightNeutrals = {
  primary: '#171717',
  primaryForeground: '#FAFAFA',
  card: '#FFFFFF',
  secondary: '#F5F5F5',
  secondaryForeground: '#171717',
  background: '#FFFFFF',
  popover: '#FFFFFF',
  popoverForeground: '#0A0A0A',
  muted: '#F5F5F5',
  mutedForeground: '#737373',
  destructive: '#E7000B',
  foreground: '#0A0A0A',
  border: '#E5E5E5',
  input: '#E5E5E5',
  ring: '#D4D4D4',
  accent: '#F7F7F7',
  accentForeground: '#343434',
  onScrim: '#FFFFFF',
  onTint: '#F4EFE6',
};

export const themes = {
  'ink-coral': {
    label: 'Ink & Coral',
    dark: {
      primary: '#F4F2F8',
      primaryForeground: '#1A1424',
      card: '#181626',
      secondary: '#201D2E',
      secondaryForeground: '#DAD6E6',
      background: '#0E0D18',
      popover: '#181626',
      popoverForeground: '#F4F2F8',
      muted: '#201D2E',
      mutedForeground: '#ACA6C2',
      destructive: '#FF6467',
      foreground: '#F4F2F8',
      border: '#2A2740',
      input: '#332F4A',
      ring: '#67607F',
      accent: '#201D2E',
      accentForeground: '#F4F2F8',
      brand: '#FF6B57',
      brandForeground: '#1A1424',
      brandOnLight: '#B8321F',
      surfaceRaised: '#1B1929',
      tag: '#201D2E',
      faint: '#9690AE',
      borderStrong: '#3D3956',
      success: '#8FD3FF',
      scrim: '#0E0D18',
      onScrim: '#FFFFFF',
      onTint: '#F4EFE6',
    },
    light: {
      ...lightNeutrals,
      brand: '#C4321F',
      brandForeground: '#FFFFFF',
      brandOnLight: '#B8321F',
      surfaceRaised: '#F4F2F8',
      tag: '#EFECF5',
      faint: '#706A84',
      borderStrong: '#D4D0E0',
      success: '#1D6FA5',
      scrim: '#0E0D18',
    },
    /** Hero, player and episode-card backdrops (always dark panels). */
    tints: ['#2B2850', '#2C3245', '#3F2A30', '#3A2B30'],
    /** Native splash / Android adaptive icon backgrounds. */
    iconBackground: '#181626',
    splashBackground: '#0E0D18',
  },
};

/** Illustration palette of the episode videos (studio). */
export const collage = {
  mint: '#4FDDB0',
  teal: '#1E9E83',
  pink: '#E8457A',
  yellow: '#F2D134',
  gold: '#F5B83D',
  cream: '#F3E3C3',
  slate: '#557572',
  plum: '#2B1F4E',
  ink: '#1E1B24',
  skin: '#E9A56F',
  white: '#FBF7EE',
};

/** Text color on a book cover: dark ink on light covers, cream on dark ones (see coverInkFor). */
export const coverInk = { onLight: '#1C1C1C', onDark: '#F4EFE6' };

export const fonts = {
  display: {
    family: 'Space Grotesk',
    weights: [500, 700],
    stack: "'Space Grotesk', system-ui, sans-serif",
    /** expo-font family names (@expo-google-fonts/space-grotesk) */
    native: { 500: 'SpaceGrotesk_500Medium', 700: 'SpaceGrotesk_700Bold' },
  },
  body: {
    family: 'Inter',
    weights: [400, 500, 600, 700],
    stack: "'Inter', system-ui, sans-serif",
    native: { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' },
  },
  /** Episode labels and paper-tape captions in the videos. */
  condensed: {
    family: 'Oswald',
    weights: [500, 700],
    stack: "'Oswald', 'Arial Narrow', sans-serif",
    native: null,
  },
};

/** Wordmark rules: Space Grotesk 700, letter-spacing -0.03em, the period in the brand color. */
export const logo = {
  letterSpacing: '-0.03em',
  weight: 700,
  minSize: { px: 16 },
  clearSpace: 'the height of the "m"',
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999, web: '0.625rem' };

export const spacing = { gutter: 20, section: 96, maxWidth: 1240 };
