import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { FormAlert } from '@/components/auth/form-alert';
import { BrandButton } from '@/components/mintsy/brand-button';
import { CoverTile } from '@/components/mintsy/cover-tile';
import { Icon } from '@/components/mintsy/icon';
import { Wordmark } from '@/components/mintsy/wordmark';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useCatalog } from '@/lib/catalog';
import { clearFlash, useFlash } from '@/lib/flash';
import { openLegalUrl, PRIVACY_URL, SHOW_TERMS, TERMS_URL } from '@/lib/legal';
import { formatTime } from '@/lib/series';

/** Placement of the two covers fanned out behind the featured one. */
const FAN = [
  { rotate: '-9deg', side: 'left' },
  { rotate: '9deg', side: 'right' },
] as const;

export default function WelcomeScreen() {
  const { books } = useCatalog();
  // Same pick as Home: the first playable book in catalog order is featured; the next two fan out behind it
  const featured = books.find((b) => b.episodes.length > 0);
  const first = featured?.episodes[0];
  const fan = books.filter((b) => b !== featured).slice(0, FAN.length);
  // "Your account has been deleted" and similar, after leaving the app
  const notice = useFlash('welcome');
  useEffect(() => () => clearFlash('welcome'), []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="w-full max-w-[480px] flex-grow self-center px-6 pb-8 pt-7">
        <HStack className="items-center gap-2.5">
          <Wordmark variant="tile" />
          <Wordmark />
        </HStack>

        {notice ? (
          <Pressable accessibilityHint="Dismisses the message" onPress={() => clearFlash('welcome')} className="mt-5">
            <FormAlert tone="success" message={notice} />
          </Pressable>
        ) : null}

        {/* Decorative fan of covers */}
        <Box
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="mt-7 h-[330px] w-full max-w-[342px] self-center"
        >
          {fan.map((book, i) => {
            const { rotate, side } = FAN[i];
            return (
              <Box
                key={book.id}
                style={{ transform: [{ rotate }] }}
                className={`absolute top-[54px] ${side === 'left' ? 'left-[22px]' : 'right-[22px]'}`}
              >
                <CoverTile book={book} width={128} />
              </Box>
            );
          })}
          {featured && first ? (
            <>
              <Box className="absolute left-1/2 top-5 -ml-[76px]">
                <CoverTile book={featured} width={152} />
              </Box>
              <HStack className="absolute left-0 right-0 top-[262px] justify-center">
                <HStack className="h-10 items-center gap-2 rounded-full border border-input bg-surface-raised px-3.5">
                  <Box className="h-[22px] w-[22px] items-center justify-center rounded-full bg-brand">
                    <Icon name="play" size={10} className="text-brand-foreground" />
                  </Box>
                  <Text className="font-inter-medium text-[13px] text-foreground">
                    Episode 1 of {featured.episodes.length} · {formatTime(first.durationSec)}
                  </Text>
                </HStack>
              </HStack>
            </>
          ) : null}
        </Box>

        <VStack className="mt-auto gap-3.5">
          <Text accessibilityRole="header" className="font-display text-[34px] leading-[37px] tracking-[-0.6px] text-foreground">
            Every great book, one 5-minute episode at a time.
          </Text>
          <Text className="font-inter text-[16px] leading-[24px] text-muted-foreground">
            Watch books as short video series, chapter by chapter, with a transcript for every episode.
          </Text>
        </VStack>

        <VStack className="mt-7 gap-3">
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
      </ScrollView>
    </SafeAreaView>
  );
}
