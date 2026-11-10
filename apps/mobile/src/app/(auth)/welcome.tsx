import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { FormAlert } from '@/components/auth/form-alert';
import { SocialSignIn } from '@/components/auth/social-sign-in';
import { BrandButton } from '@/components/mintsy/brand-button';
import { CoverTile } from '@/components/mintsy/cover-tile';
import { Icon } from '@/components/mintsy/icon';
import { Wordmark } from '@/components/mintsy/wordmark';
import { SafeAreaView } from '@/components/safe-area-view';
import { Skeleton } from '@/components/states/skeleton';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { Book } from '@/data/types';
import { useRailInsets } from '@/hooks/use-rail-insets';
import { useWideLayout } from '@/hooks/use-wide-layout';
import { useCatalog } from '@/lib/catalog';
import { clearFlash, useFlash } from '@/lib/flash';
import { openLegalUrl, PRIVACY_URL, SHOW_TERMS, TERMS_URL } from '@/lib/legal';
import { formatTime } from '@/lib/series';

/** Fan geometry: narrow from design 4, wide from design 22 (the fan's box is centered in the left pane). */
const FAN_LAYOUT = {
  narrow: { width: 342, height: 330, side: 128, sideTop: 54, sideInset: 22, main: 152, mainTop: 20, pillTop: 262 },
  wide: { width: 332, height: 318, side: 140, sideTop: 40, sideInset: 0, main: 168, mainTop: 0, pillTop: 278 },
};

/** Headline sizes. The open, rotated window is only 669 tall, so it gets a smaller one to fit without scrolling. */
const HEADLINE = {
  narrow: { fontSize: 34, lineHeight: 37, letterSpacing: -0.6 },
  wide: { fontSize: 40, lineHeight: 42, letterSpacing: -0.8 },
  shortWide: { fontSize: 32, lineHeight: 35, letterSpacing: -0.6 },
};

/** On phones the fan shrinks into the height the copy and buttons leave; below this scale it's dropped. */
const MIN_FAN_SCALE = 0.4;

/**
 * The mockups' covers, drawn when the catalog has fewer than three books (e.g. an unseeded local backend),
 * so the decorative fan never shows up empty.
 */
const SAMPLE_COVERS: Book[] = [
  { title: 'The Psychology of Money', author: 'Morgan Housel', coverTone: '#E7DFCF', tint: '#24382F' },
  { title: 'The Intelligent Investor', author: 'Benjamin Graham', coverTone: '#1E3557', tint: '#1E2B3D' },
  { title: 'Atomic Habits', author: 'James Clear', coverTone: '#C9D6CF', tint: '#24382F' },
].map((b, i) => ({ ...b, id: `sample-${i}`, category: 'Finance', description: '', episodes: [] }));

export default function WelcomeScreen() {
  const { books, status } = useCatalog();
  // A fresh install has no catalog saved yet: placeholders hold the fan's shape until the covers arrive, then fade in
  const loading = status === 'loading';
  const [fadeIn] = useState(loading);
  const { wide, shortWide, paneWidth, tightPanes } = useWideLayout();
  const insets = useRailInsets();
  // Same pick as Home: the first playable book in catalog order is featured; the next two fan out behind it
  const featured = books.find((b) => b.episodes.length > 0);
  const first = featured?.episodes[0];
  const ordered = featured ? [featured, ...books.filter((b) => b !== featured)] : books;
  const [main, left, right] = [...ordered, ...SAMPLE_COVERS].slice(0, 3);
  // "Your account has been deleted" and similar, after leaving the app
  const notice = useFlash('welcome');
  useEffect(() => () => clearFlash('welcome'), []);
  const [socialError, setSocialError] = useState<string>();
  /** Height left for the fan on phones (measured), so the screen fits without scrolling. */
  const [fanSpace, setFanSpace] = useState<number>();

  const logo = (
    <HStack className="items-center gap-2.5">
      <Wordmark variant="tile" />
      <Wordmark onTint={wide} />
    </HStack>
  );

  const fanLayout = FAN_LAYOUT[wide ? 'wide' : 'narrow'];
  const fan = (
    // Decorative fan of covers
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: '100%', maxWidth: fanLayout.width, height: fanLayout.height }}
      className="self-center"
    >
      {[
        { book: left, rotate: '-9deg', edge: { left: fanLayout.sideInset } },
        { book: right, rotate: '9deg', edge: { right: fanLayout.sideInset } },
      ].map(({ book, rotate, edge }, i) => (
        <Box key={i} style={{ position: 'absolute', top: fanLayout.sideTop, ...edge, transform: [{ rotate }] }}>
          <FanCover book={book} width={fanLayout.side} loading={loading} fadeIn={fadeIn} />
        </Box>
      ))}
      <Box style={{ position: 'absolute', top: fanLayout.mainTop, left: '50%', marginLeft: -fanLayout.main / 2 }}>
        <FanCover book={main} width={fanLayout.main} loading={loading} fadeIn={fadeIn} />
      </Box>
      {featured && first ? (
        <HStack style={{ top: fanLayout.pillTop }} className="absolute left-0 right-0 justify-center">
          <HStack className="h-10 items-center gap-2 rounded-full border border-input bg-surface-raised px-3.5">
            <Box className="h-[22px] w-[22px] items-center justify-center rounded-full bg-brand">
              <Icon name="play" size={10} className="text-brand-foreground" />
            </Box>
            <Text className="font-inter-medium text-[13px] text-foreground">
              Episode 1 of {featured.episodes.length} · {formatTime(first.durationSec)}
            </Text>
          </HStack>
        </HStack>
      ) : null}
    </Box>
  );

  const noticeAlert = notice ? (
    <Pressable accessibilityHint="Dismisses the message" onPress={() => clearFlash('welcome')}>
      <FormAlert tone="success" message={notice} />
    </Pressable>
  ) : null;

  const pitch = (
    <VStack className="gap-3.5">
      <Text
        accessibilityRole="header"
        style={HEADLINE[shortWide ? 'shortWide' : wide ? 'wide' : 'narrow']}
        className="font-display text-foreground"
      >
        Every great book, one 5-minute episode at a time.
      </Text>
      <Text
        style={{ fontSize: wide ? 17 : 16, lineHeight: wide ? 25 : 24 }}
        className="font-inter text-muted-foreground"
      >
        Watch books as short video series, chapter by chapter, with a transcript for every episode.
      </Text>
    </VStack>
  );

  const actions = (
    <VStack className="gap-3">
      {/* Apple first, at least as prominent as Google (App Store guideline 4.8) */}
      <SocialSignIn
        divider="below"
        onError={(message) => {
          setSocialError(message);
          if (message) clearFlash('welcome');
        }}
      />
      {socialError ? <FormAlert message={socialError} /> : null}
      <BrandButton label="Create account" height={54} onPress={() => router.push('/sign-up')} />
      <BrandButton label="Sign in" variant="outline" height={54} onPress={() => router.push('/sign-in')} />
      <Text className="mt-1.5 text-center font-inter text-[12px] leading-[18px] text-faint">
        By continuing you agree to our{' '}
        {/* Terms is Apple's standard EULA, so it's linked on iOS only (same as the paywall) */}
        {SHOW_TERMS ? (
          <>
            <Text accessibilityRole="link" onPress={() => openLegalUrl(TERMS_URL)} className="font-inter text-[12px] text-secondary-foreground underline">
              Terms
            </Text>{' '}
            and{' '}
          </>
        ) : null}
        <Text accessibilityRole="link" onPress={() => openLegalUrl(PRIVACY_URL)} className="font-inter text-[12px] text-secondary-foreground underline">
          Privacy Policy
        </Text>
        .
      </Text>
    </VStack>
  );

  // ── Wide: cover art pane left, pitch and sign-in right, which scrolls when a notice or larger text needs the room ──
  if (wide) {
    return (
      <Box className="flex-1 flex-row bg-background">
        <Box
          style={{
            width: paneWidth,
            backgroundColor: main.tint,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
          }}
          className="flex-none overflow-hidden"
        >
          <Box className="px-8 pt-7">{logo}</Box>
          <Box className={`flex-1 justify-center pb-16 ${tightPanes ? 'px-6' : 'px-[62px]'}`}>{fan}</Box>
        </Box>
        <Box style={{ paddingTop: insets.top, paddingBottom: insets.bottom, paddingRight: insets.right }} className="flex-1">
          <ScrollView
            alwaysBounceVertical={false}
            contentContainerClassName={`min-h-full justify-center ${shortWide ? 'px-8 py-4' : `py-8 ${tightPanes ? 'px-6' : 'px-14'}`}`}
          >
            <VStack className="w-full max-w-[420px] gap-[18px]">
              {noticeAlert}
              {pitch}
              {actions}
            </VStack>
          </ScrollView>
        </Box>
      </Box>
    );
  }

  // ── Narrow: one column that always fits the screen; the fan takes whatever height is left ──
  const fanScale = fanSpace === undefined ? 0 : Math.min(1, fanSpace / fanLayout.height);
  return (
    <SafeAreaView className="flex-1 bg-background">
      <VStack className="w-full max-w-[480px] flex-1 self-center px-6 pb-4 pt-5">
        {logo}
        {noticeAlert ? <Box className="mt-4">{noticeAlert}</Box> : null}
        <Box
          onLayout={(e) => setFanSpace(e.nativeEvent.layout.height)}
          className="my-4 flex-1 items-center justify-center"
        >
          {fanScale >= MIN_FAN_SCALE ? (
            <Box style={{ width: '100%', transform: [{ scale: fanScale }] }}>{fan}</Box>
          ) : null}
        </Box>
        {pitch}
        <Box className="mt-6">{actions}</Box>
      </VStack>
    </SafeAreaView>
  );
}

/** One tile of the fan: a placeholder while the catalog's first load runs, then the cover (faded in if it came late). */
function FanCover({ book, width, loading, fadeIn }: { book: Book; width: number; loading: boolean; fadeIn: boolean }) {
  if (loading) return <Skeleton width={width} height={Math.round(width * 1.5)} radius={8} />;
  return (
    <Animated.View key={book.id} entering={fadeIn ? FadeIn.duration(300) : undefined}>
      <CoverTile book={book} width={width} />
    </Animated.View>
  );
}
