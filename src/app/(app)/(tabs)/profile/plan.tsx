import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { BrandButton } from '@/components/mintsy/brand-button';
import { ScreenHeader } from '@/components/mintsy/screen-header';
import { Spinner } from '@/components/mintsy/spinner';
import { SafeAreaView } from '@/components/safe-area-view';
import { SettingsLinkRow } from '@/components/settings/settings-rows';
import { SettingsSection } from '@/components/settings/settings-section';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { READABLE_MAX_WIDTH, useWideLayout } from '@/hooks/use-wide-layout';
import { loadOffer, planName } from '@/lib/offering';
import { isWebStore, openPaywall, useManageSubscription, usePremium } from '@/lib/premium';

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Plan details (not designed; follows the Settings look): plan, price, renewal, manage and restore. */
export default function PlanDetailsScreen() {
  const premium = usePremium();
  const { wide } = useWideLayout();
  const [price, setPrice] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const name = planName(premium.productId);
  const storeName = premium.store === 'app_store' ? 'App Store' : premium.store === 'play_store' ? 'Google Play Store' : null;
  // Bought on the web: App Store rules allow no link, button or price for it here, only where to manage it
  const web = isWebStore(premium.store);

  // The price comes from the store via the offering; match it to the subscribed product
  useEffect(() => {
    if (!premium.isPremium || !premium.available || web) return;
    let cancelled = false;
    loadOffer()
      .then((offer) => {
        const plan = [offer.yearly, offer.monthly].find((p) => p?.pkg.product.identifier === premium.productId);
        if (!cancelled && plan) setPrice(`${plan.priceString}/${plan.periodNoun}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [premium.isPremium, premium.available, premium.productId, web]);

  const manage = useManageSubscription();

  async function restore() {
    setRestoring(true);
    try {
      const active = await premium.restore();
      Alert.alert(active ? 'Purchases restored' : 'Nothing to restore', active ? 'mintsy Premium is active on this account.' : 'We couldn’t find a mintsy Premium subscription for this store account.');
    } catch {
      Alert.alert('Couldn’t restore purchases', 'Check your connection and try again.');
    } finally {
      setRestoring(false);
    }
  }

  const dateRow = premium.expiresAt
    ? premium.periodType === 'trial'
      ? { label: 'Free trial ends', value: longDate(premium.expiresAt) }
      : premium.willRenew
        ? { label: 'Renews', value: longDate(premium.expiresAt) }
        : { label: 'Expires', value: longDate(premium.expiresAt) }
    : null;

  const rows: { label: string; value: string }[] = premium.isPremium
    ? [
        { label: 'Plan', value: name ? `Premium · ${name}` : 'Premium' },
        ...(price && !web ? [{ label: 'Price', value: price }] : []),
        ...(dateRow ? [dateRow] : []),
      ]
    : [{ label: 'Plan', value: 'Free' }];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-5 pb-10 pt-3"
        contentContainerStyle={wide ? { maxWidth: READABLE_MAX_WIDTH + 40, width: '100%', alignSelf: 'center' } : undefined}
      >
        <ScreenHeader title="Plan details" backHref="/profile/settings" backLabel="Back to settings" />

        {premium.loading ? (
          <HStack className="mt-10 justify-center">
            <Spinner className="text-muted-foreground" />
          </HStack>
        ) : (
          <VStack className="mt-[26px] gap-[26px]">
            <SettingsSection title="Subscription">
              {rows.map((row) => (
                <HStack key={row.label} className="min-h-14 items-center justify-between gap-3 px-4">
                  <Text className="font-inter text-[15px] text-foreground">{row.label}</Text>
                  <Text numberOfLines={1} className="shrink font-inter text-[14px] text-muted-foreground">
                    {row.value}
                  </Text>
                </HStack>
              ))}
            </SettingsSection>

            {premium.isPremium ? (
              <SettingsSection>
                {web ? null : <SettingsLinkRow role="link" label="Manage subscription" onPress={manage} />}
                <SettingsLinkRow label="Restore purchases" value={restoring ? 'Restoring…' : undefined} onPress={restoring ? () => {} : restore} />
              </SettingsSection>
            ) : (
              <VStack className="gap-3">
                <Text className="font-inter text-[15px] leading-[22px] text-muted-foreground">
                  You’re on the free plan: the first episodes of every series. Premium unlocks every episode, full transcripts and downloads.
                </Text>
                <BrandButton label="Upgrade to Premium" height={52} onPress={() => openPaywall()} />
                <BrandButton label="Restore purchases" variant="outline" height={48} loading={restoring} onPress={restore} />
              </VStack>
            )}

            {premium.isPremium && web ? (
              <Text className="px-1 font-inter text-[13px] leading-[19px] text-faint">
                You subscribed on the web. Manage or cancel at app.getmintsy.com
              </Text>
            ) : premium.isPremium && storeName ? (
              <Text className="px-1 font-inter text-[13px] leading-[19px] text-faint">
                Billed by the {storeName}. Cancel at least 24 hours before the end of the period to avoid renewal.
              </Text>
            ) : null}
          </VStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
