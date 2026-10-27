import { router } from 'expo-router';
import { Alert, ScrollView } from 'react-native';

import { BrandButton } from '@/components/mintsy/brand-button';
import { CoverTile } from '@/components/mintsy/cover-tile';
import { Icon } from '@/components/mintsy/icon';
import { Wordmark } from '@/components/mintsy/wordmark';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getBook } from '@/data/mock';
import { formatTime } from '@/lib/series';

const FAN = [
  { id: 'intelligent-investor', rotate: '-9deg', side: 'left' },
  { id: 'atomic-habits', rotate: '9deg', side: 'right' },
] as const;

function showLegal(title: string) {
  // TODO: link to the hosted pages once they exist
  Alert.alert(title, 'Coming soon.');
}

export default function WelcomeScreen() {
  const featured = getBook('psychology-of-money')!;
  const first = featured.episodes[0];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow px-6 pb-8 pt-7">
        <HStack className="items-center gap-2.5">
          <Wordmark variant="tile" />
          <Wordmark />
        </HStack>

        {/* Decorative fan of covers */}
        <Box
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="mt-7 h-[330px] w-full max-w-[342px] self-center"
        >
          {FAN.map(({ id, rotate, side }) => (
            <Box
              key={id}
              style={{ transform: [{ rotate }] }}
              className={`absolute top-[54px] ${side === 'left' ? 'left-[22px]' : 'right-[22px]'}`}
            >
              <CoverTile book={getBook(id)!} width={128} />
            </Box>
          ))}
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
            <Text accessibilityRole="link" onPress={() => showLegal('Terms')} className="font-inter text-[12px] text-secondary-foreground underline">
              Terms
            </Text>{' '}
            and{' '}
            <Text accessibilityRole="link" onPress={() => showLegal('Privacy Policy')} className="font-inter text-[12px] text-secondary-foreground underline">
              Privacy Policy
            </Text>
            .
          </Text>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
