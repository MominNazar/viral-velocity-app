import { getJSON, setSetting } from './settings.js';

export const TIER_ORDER = ['Starter', 'Pro', 'Expert'];

export const DEFAULT_TIER_PRICING = {
  Starter: {
    tokens: 5000,
    monthly: { price: 4.99, discount: 0 },
    annual: { price: 40.99, discount: 50 },
  },
  Pro: {
    tokens: 15000,
    popular: true,
    monthly: { price: 12.99, discount: 0 },
    annual: { price: 149.99, discount: 20 },
  },
  Expert: {
    tokens: 40000,
    monthly: { price: 29.99, discount: 0 },
    annual: { price: 299.99, discount: 25 },
  },
};

export const DEFAULT_ONE_TIME_PACKS = [
  { id: 'pack_1k', label: '1,000 Tokens', tokens: 1000, price: 2.99 },
  { id: 'pack_5k', label: '5,000 Tokens', tokens: 5000, price: 9.99 },
  { id: 'pack_15k', label: '15,000 Tokens', tokens: 15000, price: 24.99 },
];

function finalPrice(price, discount) {
  return +(price * (1 - (discount || 0) / 100)).toFixed(2);
}

export function ensureTierPricing() {
  if (!getJSON('tier_pricing')) {
    setSetting('tier_pricing', DEFAULT_TIER_PRICING);
  }
  if (!getJSON('one_time_packs')) {
    setSetting('one_time_packs', DEFAULT_ONE_TIME_PACKS);
  }
}

export function getTierPricing() {
  return getJSON('tier_pricing') || DEFAULT_TIER_PRICING;
}

export function getOneTimePacks() {
  return getJSON('one_time_packs') || DEFAULT_ONE_TIME_PACKS;
}

export function buildPlanCatalog() {
  const tiers = getTierPricing();
  const plans = [];
  for (const tier of TIER_ORDER) {
    const t = tiers[tier];
    if (!t) continue;
    for (const cycle of ['monthly', 'annual']) {
      const p = t[cycle];
      if (!p) continue;
      plans.push({
        id: `${tier}-${cycle}`,
        tier,
        cycle,
        tokens: t.tokens,
        popular: !!t.popular,
        price: p.price,
        discount: p.discount ?? 0,
        finalPrice: finalPrice(p.price, p.discount),
        period: cycle === 'monthly' ? 'mo' : 'year',
        label: tier,
      });
    }
  }
  return plans;
}

export function tierRank(tier) {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? 0 : i + 1;
}

export function isBestPlan(tier, cycle) {
  return tier === 'Expert' && cycle === 'annual';
}
