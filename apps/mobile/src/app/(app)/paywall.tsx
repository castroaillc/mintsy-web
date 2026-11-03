import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandButton } from '@/components/mintsy/brand-button';
import { Icon } from '@/components/mintsy/icon';
import { IconButton } from '@/components/mintsy/icon-button';
import { Spinner } from '@/components/mintsy/spinner';
import {
  BenefitList,
  BlockedEpisodeCard,
  LegalLinks,
  PaywallSubtitle,
  PaywallTitle,
  PlanCard,
  PlanSkeleton,
} from '@/components/premium/premium-parts';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FREE_EPISODES } from '@/data/types';
import { useWideLayout } from '@/hooks/use-wide-layout';
import { useCatalog } from '@/lib/catalog';
import { loadOffer, type Offer, type Plan } from '@/lib/offering';
import { usePremium } from '@/lib/premium';
import { useProgress } from '@/lib/progress';

const STORE_NAME = Platform.OS === 'android' ? 'Google Play' : 'App Store';

type LoadState = { status: 'loading' } | { status: 'ready'; offer: Offer } | { status: 'error' };

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Paywall modal (designs 18 / 33). `episodeId`: the episode the viewer was blocked on, carried to Welcome. */
export default function PaywallScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId?: string }>();
  const insets = useSafeAreaInsets();
  const { wide, paneWidth, tightPanes } = useWideLayout();
  const premium = usePremium();
  const { findEpisode } = useCatalog();
  const { progress } = useProgress();
  const blocked = episodeId ? findEpisode(episodeId) : undefined;

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selected, setSelected] = useState<Plan['kind']>('yearly');
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  const fetchOffer = () =>
    loadOffer()
      .then((offer) => {
        setState({ status: 'ready', offer });
        if (!offer.yearly) setSelected('monthly');
      })
      .catch((err) => {
        console.warn('Failed to load offering', err);
        setState({ status: 'error' });
      });

  // Load once on open; "Try again" reloads
  useEffect(() => void fetchOffer(), []);

  const load = () => {
    setState({ status: 'loading' });
    fetchOffer();
  };

  const offer = state.status === 'ready' ? state.offer : null;
  const plan = offer ? (offer[selected] ?? offer.yearly ?? offer.monthly) : null;

  const goToWelcome = () =>
    router.replace({ pathname: '/premium-welcome', params: episodeId ? { episodeId } : {} });

  async function buy() {
    if (!plan || busy) return;
    setBusy('purchase');
    try {
      const outcome = await premium.purchase(plan.pkg);
      // A cancelled purchase isn't an error: stay on the paywall without a message
      if (outcome === 'purchased') goToWelcome();
    } catch (err) {
      console.warn('Purchase failed', err);
      Alert.alert(
        'Purchase didn’t go through',
        'Something went wrong and you haven’t been charged. Check your connection and try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    if (busy) return;
    setBusy('restore');
    try {
      const active = await premium.restore();
      if (active) goToWelcome();
      else Alert.alert('Nothing to restore', `We couldn’t find a mintsy Premium subscription for this ${STORE_NAME} account.`);
    } catch (err) {
      console.warn('Restore failed', err);
      Alert.alert('Couldn’t restore purchases', 'Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }

  const trial = plan?.trial ?? null;
  const ctaLabel = trial ? `Start ${trial.adjective} free trial` : 'Continue';
  const fineprint = plan
    ? `${trial ? `Free for ${trial.noun}, then ` : ''}${plan.priceString}/${plan.periodNoun}. Renews automatically unless cancelled at least 24 hours before the period ends. Manage or cancel anytime in your ${STORE_NAME} settings.`
    : `Renews automatically unless cancelled at least 24 hours before the period ends. Manage or cancel anytime in your ${STORE_NAME} settings.`;

  const freeWatched = blocked
    ? blocked.book.episodes.filter((e) => e.number <= FREE_EPISODES && progress[e.id]?.completed).length
    : 0;

  const closeButton = (
    <Box className="-ml-2.5 self-start">
      <IconButton icon="close" variant="ghost" iconSize={22} accessibilityLabel="Close" onPress={close} />
    </Box>
  );

  const restoreButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: busy === 'restore', disabled: !!busy || !premium.available }}
      disabled={!!busy || !premium.available}
      onPress={restore}
      className="h-11 flex-row items-center gap-2 active:opacity-70"
    >
      {busy === 'restore' ? <Spinner className="text-muted-foreground" /> : null}
      <Text className="font-inter-medium text-[14px] text-muted-foreground">Restore purchases</Text>
    </Pressable>
  );

  const blockedCard = blocked ? (
    <BlockedEpisodeCard book={blocked.book} episode={blocked.episode} freeWatched={freeWatched} />
  ) : null;

  const plans = (
    <VStack accessibilityRole="radiogroup" accessibilityLabel="Choose a plan" className={wide ? 'gap-3.5' : 'gap-2.5'}>
      {state.status === 'loading' ? <PlanSkeleton large={wide} /> : null}
      {state.status === 'error' ? (
        <VStack className="items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <Icon name="alert" size={22} className="text-muted-foreground" />
          <Text className="text-center font-inter text-[15px] leading-[22px] text-foreground">
            We couldn’t load the plans right now.
          </Text>
          <BrandButton label="Try again" variant="outline" height={44} onPress={load} className="self-stretch" />
        </VStack>
      ) : null}
      {offer
        ? (['yearly', 'monthly'] as const).map((kind) => {
            const p = offer[kind];
            return p ? (
              <PlanCard
                key={kind}
                plan={p}
                large={wide}
                selected={plan?.kind === kind}
                savingsPercent={offer.savingsPercent}
                onPress={() => setSelected(kind)}
              />
            ) : null;
          })
        : null}
    </VStack>
  );

  const purchaseBlock = (
    <>
      <BrandButton
        label={state.status === 'ready' ? ctaLabel : 'Continue'}
        height={56}
        loading={busy === 'purchase'}
        disabled={!plan || busy === 'restore'}
        onPress={buy}
        className={wide ? 'mt-[22px]' : 'mt-5'}
      />
      <Text className="mt-3 text-center font-inter text-[12px] leading-[18px] text-faint">{fineprint}</Text>
      <Box className="mt-2">
        <LegalLinks />
      </Box>
      <Pressable accessibilityRole="button" onPress={close} className="mt-2.5 h-11 items-center justify-center active:opacity-70">
        <Text className="font-inter-medium text-[15px] text-muted-foreground">Not now, keep browsing free episodes</Text>
      </Pressable>
    </>
  );

  // ── Wide (e.g. iPhone Duo open): pitch on the left, plans and purchase on the right ──
  if (wide) {
    return (
      <Box
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}
        className="flex-1 flex-row bg-background"
      >
        <ScrollView
          style={{ width: paneWidth }}
          className="flex-none border-r border-border"
          contentContainerClassName="gap-[18px] px-10 pb-8 pt-5"
        >
          {closeButton}
          {blockedCard}
          <Box className="mt-2">
            <PaywallTitle size={34} />
          </Box>
          <PaywallSubtitle />
          <Box className="mt-1">
            <BenefitList />
          </Box>
        </ScrollView>
        <ScrollView className="flex-1" contentContainerClassName={`min-h-full justify-center py-8 ${tightPanes ? 'px-6' : 'px-12'}`}>
          <HStack className="mb-[18px] justify-end">{restoreButton}</HStack>
          {plans}
          {purchaseBlock}
        </ScrollView>
      </Box>
    );
  }

  return (
    <Box style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} contentContainerClassName="px-6 pt-3">
        <HStack className="h-11 items-center justify-between">
          {closeButton}
          {restoreButton}
        </HStack>
        {blockedCard ? <Box className="mt-2.5">{blockedCard}</Box> : null}
        <Box className="mt-[26px]">
          <PaywallTitle />
        </Box>
        <Box className="mt-2.5">
          <PaywallSubtitle />
        </Box>
        <Box className="mt-[22px]">
          <BenefitList />
        </Box>
        {/* Room above the first card for its badge */}
        <Box className="mt-[26px]">{plans}</Box>
        {purchaseBlock}
      </ScrollView>
    </Box>
  );
}
