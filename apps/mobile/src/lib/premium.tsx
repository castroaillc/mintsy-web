import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesError, type PurchasesPackage } from 'react-native-purchases';

import { FREE_EPISODES, type Episode } from '@/data/types';
import { authClient } from '@/lib/auth-client';
import { useCatalog } from '@/lib/catalog';
import { graphql } from '@/lib/graphql';
import { APP_VARIANT } from '@/lib/variant';

/** RevenueCat entitlement that unlocks every episode. */
export const ENTITLEMENT_ID = 'premium';

/** The backend's view of the subscription (`me.premium`, `refreshPremium`). */
export type BackendPremium = {
  active: boolean;
  /** ISO 8601 */
  expiresAt: string | null;
  willRenew: boolean;
  /** "trial" | "normal" | "intro" */
  periodType: string | null;
  productId: string | null;
  /** Where it was bought: "app_store", "rc_billing" (web), "stripe", "play_store", "promotional", … Missing on older backends. */
  store?: string | null;
};

const PREMIUM_FIELDS = 'active expiresAt willRenew periodType productId store';
const ME_PREMIUM_QUERY = `#graphql
  query MePremium { me { premium { ${PREMIUM_FIELDS} } } }
`;
const REFRESH_PREMIUM_MUTATION = `#graphql
  mutation RefreshPremium { refreshPremium { ${PREMIUM_FIELDS} } }
`;

/** Backends that predate `Premium.store` reject the field; ask again without it. */
async function premiumRequest<T>(query: string): Promise<T> {
  try {
    return await graphql<T>(query);
  } catch (err) {
    if (!/\bstore\b/.test((err as Error).message)) throw err;
    return graphql<T>(query.replace(' store }', ' }'));
  }
}

/** Subscriptions bought on the web (app.getmintsy.com): managed there, never from the app. */
export function isWebStore(store: string | null) {
  return store === 'rc_billing' || store === 'stripe';
}

// ── RevenueCat setup ────────────────────────────────────────────────

// Keys belong to one RevenueCat app and so one bundle id, so preview never borrows production's: without its own key
// purchases are simply off. Never put a `test_` key in the preview ones: the SDK aborts release builds that use one.
const API_KEY =
  APP_VARIANT === 'preview'
    ? Platform.select({
        ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY_PREVIEW,
        android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY_PREVIEW,
      })
    : Platform.select({
        ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
        android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      });

let configured = false;

/**
 * Configures RevenueCat once per launch. Without a key for this platform (web, or dev without keys)
 * purchases stay off: nobody is premium on the device and the paywall shows its error state.
 */
function configurePurchases() {
  if (configured) return true;
  if (!API_KEY) return false;
  try {
    if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
    // No appUserID: the SDK starts anonymous and we logIn() as soon as there's a session
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
  } catch (err) {
    console.warn('RevenueCat configure failed', err);
  }
  return configured;
}

/** True when RevenueCat is configured on this device, so offerings and purchases can work. */
export function purchasesAvailable() {
  return configurePurchases();
}

/** Logs RevenueCat out of the current user (no-op when it's already anonymous or not configured). */
export async function logOutPurchases() {
  if (!configured) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch (err) {
    console.warn('RevenueCat logOut failed', err);
  }
}

export function isPurchaseCancelled(err: unknown) {
  const e = err as Partial<PurchasesError> | undefined;
  return e?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || e?.userCancelled === true;
}

// ── Context ─────────────────────────────────────────────────────────

export type PurchaseOutcome = 'purchased' | 'cancelled';

type PremiumContextValue = {
  isPremium: boolean;
  /** ISO 8601; when the current period (or trial) ends. */
  expiresAt: string | null;
  willRenew: boolean;
  /** "trial" | "normal" | "intro" (RevenueCat's upper-case values are lowered). */
  periodType: string | null;
  productId: string | null;
  /** Store page where the subscription is managed, if the store gave one. */
  managementURL: string | null;
  /**
   * Store the subscription was bought in, lower case: "app_store", "play_store", "rc_billing" / "stripe" (web),
   * "promotional", … From RevenueCat on the device, else the backend's `Premium.store`.
   */
  store: string | null;
  /** True until the first entitlement check for the signed-in user finishes. */
  loading: boolean;
  /** False when RevenueCat isn't configured (no key for this platform). */
  available: boolean;
  /** Buys the package. Resolves 'cancelled' when the user backs out; throws on any other failure. */
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  /** Restores store purchases to this account. Resolves whether Premium is now active. */
  restore: () => Promise<boolean>;
  /** Re-reads entitlements from RevenueCat and the backend, then refetches the catalog. */
  refresh: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

function lower(value: string | null | undefined) {
  return value ? value.toLowerCase() : null;
}

/**
 * Premium state for the signed-in user. On the device RevenueCat's customer info (entitlement `premium`)
 * is the source of truth; the backend's `me.premium` decides content access (Episode.locked, video URLs),
 * so every change on the device is pushed to it with `refreshPremium` and the catalog is refetched.
 */
export function PremiumProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const catalog = useCatalog();
  const refreshCatalog = catalog.refresh;

  const [available] = useState(configurePurchases);
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [backend, setBackend] = useState<BackendPremium | null>(null);
  const [loading, setLoading] = useState(true);
  // The user id RevenueCat is currently logged in as; listener updates for anyone else are ignored
  const rcUser = useRef<string | null>(null);

  /** Pushes the device's entitlement to the backend, then refetches the catalog so unlocked episodes get URLs. */
  const syncBackend = useCallback(async () => {
    try {
      const data = await premiumRequest<{ refreshPremium: BackendPremium }>(REFRESH_PREMIUM_MUTATION);
      setBackend(data.refreshPremium);
    } catch (err) {
      console.warn('refreshPremium failed', err);
    }
    await refreshCatalog();
  }, [refreshCatalog]);

  // Identify the RevenueCat customer as the Better Auth user; log out on sign-out. Never purchase anonymously.
  useEffect(() => {
    if (isPending) return;
    let cancelled = false;

    async function identify() {
      setInfo(null);
      setBackend(null);
      if (!userId) {
        if (available && rcUser.current) {
          rcUser.current = null;
          // logOut() rejects when the current RevenueCat user is already anonymous
          if (!(await Purchases.isAnonymous().catch(() => true))) await Purchases.logOut().catch(() => {});
        }
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(true);
      const [rc, server] = await Promise.all([
        available
          ? Purchases.logIn(userId)
              .then((r) => r.customerInfo)
              .catch((err) => {
                console.warn('RevenueCat logIn failed', err);
                return null;
              })
          : Promise.resolve(null),
        premiumRequest<{ me: { premium: BackendPremium } | null }>(ME_PREMIUM_QUERY)
          .then((d) => d.me?.premium ?? null)
          .catch(() => null),
      ]);
      if (cancelled) return;
      rcUser.current = available ? userId : null;
      setInfo(rc);
      setBackend(server);
      setLoading(false);
    }

    identify();
    return () => {
      cancelled = true;
    };
  }, [available, isPending, userId]);

  // Keep customer info fresh (renewals, expiry, purchases made elsewhere) and tell the backend when access flips
  const rcActive = !!info?.entitlements.active[ENTITLEMENT_ID];
  const rcActiveRef = useRef(rcActive);
  useEffect(() => {
    rcActiveRef.current = rcActive;
  }, [rcActive]);
  useEffect(() => {
    if (!available) return;
    const listener = (next: CustomerInfo) => {
      if (!rcUser.current || next.originalAppUserId !== rcUser.current) return;
      const nextActive = !!next.entitlements.active[ENTITLEMENT_ID];
      const changed = nextActive !== rcActiveRef.current;
      setInfo(next);
      if (changed) syncBackend();
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [available, syncBackend]);

  // Premium on the device but the catalog still has locks (backend behind, e.g. webhook not in yet): sync once per user
  const syncedFor = useRef<string | null>(null);
  const hasLockedEpisodes = catalog.books.some((b) => b.episodes.some((e) => e.locked));
  useEffect(() => {
    if (rcActive && hasLockedEpisodes && userId && syncedFor.current !== userId) {
      syncedFor.current = userId;
      syncBackend();
    }
  }, [rcActive, hasLockedEpisodes, userId, syncBackend]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<PurchaseOutcome> => {
      if (!available) throw new Error('Purchases are not available on this device.');
      if (!userId || rcUser.current !== userId) throw new Error('Sign in to subscribe.');
      try {
        const result = await Purchases.purchasePackage(pkg);
        setInfo(result.customerInfo);
      } catch (err) {
        if (isPurchaseCancelled(err)) return 'cancelled';
        throw err;
      }
      await syncBackend();
      return 'purchased';
    },
    [available, userId, syncBackend],
  );

  const restore = useCallback(async () => {
    if (!available) throw new Error('Purchases are not available on this device.');
    if (!userId || rcUser.current !== userId) throw new Error('Sign in to restore purchases.');
    const restored = await Purchases.restorePurchases();
    setInfo(restored);
    await syncBackend();
    return !!restored.entitlements.active[ENTITLEMENT_ID];
  }, [available, userId, syncBackend]);

  const refresh = useCallback(async () => {
    // Guests have no entitlements to read; still refetch the catalog (pull to refresh)
    if (!userId) return refreshCatalog();
    if (available && rcUser.current === userId) {
      try {
        setInfo(await Purchases.getCustomerInfo());
      } catch (err) {
        console.warn('getCustomerInfo failed', err);
      }
    }
    await syncBackend();
  }, [available, userId, syncBackend, refreshCatalog]);

  const value = useMemo<PremiumContextValue>(() => {
    const ent = info?.entitlements.active[ENTITLEMENT_ID];
    const server = backend?.active ? backend : null;
    return {
      // Either side saying yes counts on the device; the backend still gates the media itself
      isPremium: !!userId && (!!ent || !!server),
      expiresAt: ent ? ent.expirationDate : (server?.expiresAt ?? null),
      willRenew: ent ? ent.willRenew : (server?.willRenew ?? false),
      periodType: ent ? lower(ent.periodType) : lower(server?.periodType),
      productId: ent ? ent.productIdentifier : (server?.productId ?? null),
      managementURL: info?.managementURL ?? null,
      store: ent ? lower(ent.store) : lower(server?.store),
      loading: !!userId && loading,
      available,
      purchase,
      restore,
      refresh,
    };
  }, [info, backend, userId, loading, available, purchase, restore, refresh]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used within PremiumProvider');
  return ctx;
}

// ── Locks ───────────────────────────────────────────────────────────

/** The API's `locked` wins when present; otherwise episodes past FREE_EPISODES need Premium. */
export function isEpisodeLocked(episode: Episode, isPremium: boolean) {
  if (episode.locked !== undefined) return episode.locked;
  return episode.number > FREE_EPISODES && !isPremium;
}

export function useIsLocked() {
  const { isPremium } = usePremium();
  return useCallback((episode: Episode) => isEpisodeLocked(episode, isPremium), [isPremium]);
}

type PaywallOptions = {
  /** Replace the current screen (e.g. the player) instead of pushing over it. */
  replace?: boolean;
};

/** Opens the paywall; `episodeId` is the episode the viewer was blocked on (shown on Welcome as "Play Episode N"). */
export function openPaywall(episodeId?: string, { replace }: PaywallOptions = {}) {
  const href = { pathname: '/paywall', params: episodeId ? { episodeId } : {} } as const;
  if (replace) router.replace(href);
  else router.push(href);
}

/**
 * Opens an episode, or the paywall when it's locked for a free user. A premium user whose catalog still
 * says locked (backend not caught up yet) goes to the player, which syncs and waits instead of playing.
 */
export function useOpenEpisode() {
  const { isPremium } = usePremium();
  return useCallback(
    (episode: Episode, { replace }: PaywallOptions = {}) => {
      if (isEpisodeLocked(episode, isPremium) && !isPremium) return openPaywall(episode.id, { replace });
      const href = { pathname: '/player/[episodeId]', params: { episodeId: episode.id } } as const;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [isPremium],
  );
}

// ── Managing the subscription ───────────────────────────────────────

/** The store's own subscriptions page, for when RevenueCat has no management URL. */
export const STORE_SUBSCRIPTIONS_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  default: 'https://play.google.com/store/account/subscriptions',
});

/**
 * Opens wherever the subscription is managed: the App Store's sheet for App Store subscriptions,
 * otherwise the store's page. Used by Plan details and Delete account.
 */
export function useManageSubscription() {
  const premium = usePremium();
  return useCallback(async () => {
    try {
      if (Platform.OS === 'ios' && premium.available && (premium.store === 'app_store' || !premium.managementURL)) {
        await Purchases.showManageSubscriptions();
        await premium.refresh();
        return;
      }
      await Linking.openURL(premium.managementURL ?? STORE_SUBSCRIPTIONS_URL);
    } catch {
      Linking.openURL(STORE_SUBSCRIPTIONS_URL).catch(() => {});
    }
  }, [premium]);
}
