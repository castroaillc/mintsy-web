import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { BrandButton } from '@/components/mintsy/brand-button';
import { PremiumMark, UpNextEpisodeCard } from '@/components/premium/premium-parts';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { useWideLayout } from '@/hooks/use-wide-layout';
import { useCatalog } from '@/lib/catalog';
import { usePremium } from '@/lib/premium';
import { scheduleTrialEndingReminder } from '@/lib/reminders';

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Shown after a purchase or restore (designs 19 / 34). `episodeId`: the episode the viewer was blocked on. */
export default function PremiumWelcomeScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId?: string }>();
  const { wide, paneWidth, tightPanes } = useWideLayout();
  const { periodType, expiresAt, willRenew } = usePremium();
  const { permission } = useNotificationPermission();
  const found = useCatalog().findEpisode(episodeId ?? '');

  const trialEnd = periodType === 'trial' && expiresAt ? expiresAt : null;
  const [reminderSet, setReminderSet] = useState(false);
  useEffect(() => {
    if (!trialEnd || permission !== 'granted') return;
    scheduleTrialEndingReminder(new Date(trialEnd)).then(setReminderSet);
  }, [trialEnd, permission]);

  const message = trialEnd
    ? `Your free trial runs until ${longDate(trialEnd)}.${reminderSet ? ' We’ll remind you 2 days before it ends.' : ''}`
    : expiresAt
      ? `Your plan ${willRenew ? 'renews' : 'runs until'} ${longDate(expiresAt)}.`
      : 'Every series, every transcript, every takeaway.';

  const play = () => {
    if (!found) return;
    // Replaces this screen, so closing the player returns to where the paywall was opened
    router.replace({ pathname: '/player/[episodeId]', params: { episodeId: found.episode.id } });
  };
  const goHome = () => router.dismissTo('/');

  const actions = (
    <>
      {found ? (
        <BrandButton label={`Play Episode ${found.episode.number}`} icon="play" height={56} onPress={play} className={wide ? 'mt-2' : 'mt-4'} />
      ) : (
        <BrandButton label="Start watching" height={56} onPress={goHome} className={wide ? 'mt-2' : 'mt-4'} />
      )}
      {found ? (
        <Pressable accessibilityRole="button" onPress={goHome} className="mt-1.5 h-11 items-center justify-center active:opacity-70">
          <Text className="font-inter-medium text-[15px] text-muted-foreground">Go to Home</Text>
        </Pressable>
      ) : null}
    </>
  );

  const hero = (big: boolean) => (
    <VStack className="items-center gap-[18px]">
      <PremiumMark size={big ? 148 : 132} />
      {/* The wide pane sits on an always-dark tint, so its text uses the fixed on-tint colour */}
      <Text className={`font-inter-semibold text-[13px] uppercase tracking-[1.4px] ${big ? 'text-on-tint' : 'text-brand'}`}>
        You’re Premium
      </Text>
      <Text
        accessibilityRole="header"
        style={{ fontSize: big ? 34 : 32, lineHeight: big ? 37 : 35 }}
        className={`text-center font-display tracking-[-0.6px] ${big ? 'text-on-tint' : 'text-foreground'}`}
      >
        Every episode is unlocked.
      </Text>
      <Text
        style={{ maxWidth: big ? 320 : 300 }}
        className={`text-center font-inter text-[16px] leading-[24px] ${big ? 'text-on-tint/85' : 'text-muted-foreground'}`}
      >
        {message}
      </Text>
    </VStack>
  );

  // ── Wide: tinted celebration pane left, next episode and actions right ──
  if (wide) {
    return (
      <Box className="flex-1 flex-row bg-background">
        <SafeAreaView
          edges={['top', 'bottom', 'left']}
          style={{ width: paneWidth, backgroundColor: found?.book.tint ?? '#2B2850' }}
          className="flex-none items-center justify-center p-12"
        >
          {hero(true)}
        </SafeAreaView>
        <SafeAreaView edges={['top', 'bottom', 'right']} className={`flex-1 justify-center py-12 ${tightPanes ? 'px-6' : 'px-14'}`}>
          <VStack className="w-full max-w-[420px] gap-3.5">
            {found ? (
              <>
                <Text className="font-inter-semibold text-[13px] uppercase tracking-[1px] text-muted-foreground">
                  Pick up where you left off
                </Text>
                <UpNextEpisodeCard book={found.book} episode={found.episode} showBook />
              </>
            ) : null}
            {actions}
          </VStack>
        </SafeAreaView>
      </Box>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="min-h-full px-6 pb-8 pt-6">
        <Box className="flex-1 justify-center py-6">{hero(false)}</Box>
        {found ? <UpNextEpisodeCard book={found.book} episode={found.episode} /> : null}
        {actions}
      </ScrollView>
    </SafeAreaView>
  );
}
