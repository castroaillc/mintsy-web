import { Platform } from 'react-native';
import Purchases, {
  type PurchasesIntroPrice,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { purchasesAvailable } from '@/lib/premium';

/** RevenueCat offering the paywall sells, with packages `$rc_annual` and `$rc_monthly`. */
export const OFFERING_ID = 'default';

export type Plan = {
  kind: 'yearly' | 'monthly';
  pkg: PurchasesPackage;
  /** Localized price from the store, e.g. "$59.99". */
  priceString: string;
  /** "year" / "month", for "then $59.99/year". */
  periodNoun: string;
  /** Yearly only: localized per-month equivalent. */
  perMonthString: string | null;
  /** Free trial length when this customer can get one, e.g. { noun: "7 days", adjective: "7-day" }. */
  trial: TrialLength | null;
};

export type TrialLength = { noun: string; adjective: string };

export type Offer = {
  yearly: Plan | null;
  monthly: Plan | null;
  /** Whole percent saved by paying yearly vs 12 × monthly; null when unknown or not a saving. */
  savingsPercent: number | null;
};

const UNIT_NAMES: Record<string, string> = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' };

/** A free intro offer → "7 days" / "7-day", "1 month" / "1-month". Paid intro prices aren't trials. */
export function trialLength(intro: PurchasesIntroPrice | null): TrialLength | null {
  if (!intro || intro.price !== 0) return null;
  const unit = UNIT_NAMES[intro.periodUnit?.toUpperCase()];
  const count = intro.periodNumberOfUnits * Math.max(1, intro.cycles);
  if (!unit || count <= 0) return null;
  return { noun: `${count} ${unit}${count === 1 ? '' : 's'}`, adjective: `${count}-${unit}` };
}

/** Whole percent saved by the yearly price against twelve monthly payments. */
export function savingsPercent(yearlyPrice: number, monthlyPrice: number) {
  if (!(yearlyPrice > 0) || !(monthlyPrice > 0)) return null;
  const pct = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
  return pct > 0 ? pct : null;
}

/**
 * Loads the `default` offering (falling back to RevenueCat's current one) and works out what the paywall shows.
 * Throws when purchases aren't configured or the offering has neither package.
 */
export async function loadOffer(): Promise<Offer> {
  if (!purchasesAvailable()) throw new Error('Purchases are not set up on this device.');
  const offerings = await Purchases.getOfferings();
  const offering: PurchasesOffering | null = offerings.all[OFFERING_ID] ?? offerings.current;
  const annual = offering?.annual ?? offering?.availablePackages.find((p) => p.identifier === '$rc_annual') ?? null;
  const monthly = offering?.monthly ?? offering?.availablePackages.find((p) => p.identifier === '$rc_monthly') ?? null;
  if (!annual && !monthly) throw new Error('No plans are available right now.');

  // iOS knows whether this Apple ID already used its intro offer; Google only returns offers the user can take
  let ineligible = new Set<string>();
  if (Platform.OS === 'ios') {
    const ids = [annual, monthly].filter((p): p is PurchasesPackage => !!p).map((p) => p.product.identifier);
    try {
      const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
      ineligible = new Set(
        Object.entries(result)
          .filter(([, e]) => e.status !== Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE &&
            e.status !== Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_UNKNOWN)
          .map(([id]) => id),
      );
    } catch {
      // Unknown eligibility: show the offer; the App Store sheet has the final word
    }
  }

  const plan = (kind: Plan['kind'], pkg: PurchasesPackage | null): Plan | null => {
    if (!pkg) return null;
    const p = pkg.product;
    return {
      kind,
      pkg,
      priceString: p.priceString,
      periodNoun: kind === 'yearly' ? 'year' : 'month',
      perMonthString: kind === 'yearly' ? p.pricePerMonthString : null,
      trial: ineligible.has(p.identifier) ? null : trialLength(p.introPrice),
    };
  };

  return {
    yearly: plan('yearly', annual),
    monthly: plan('monthly', monthly),
    savingsPercent: annual && monthly ? savingsPercent(annual.product.price, monthly.product.price) : null,
  };
}

/** "Premium · Yearly" etc. from a store product id, by its period word. */
export function planName(productId: string | null) {
  if (!productId) return null;
  if (/year|annual|12m/i.test(productId)) return 'Yearly';
  if (/month|1m/i.test(productId)) return 'Monthly';
  return null;
}
