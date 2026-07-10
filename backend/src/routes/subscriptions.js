import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { ah } from '../middleware/error.js';
import { requireUser, computeAccess } from '../middleware/auth.js';
import { getSetting } from '../lib/settings.js';
import {
  buildPlanCatalog, getOneTimePacks, getTierPricing, isBestPlan, tierRank,
} from '../lib/pricing.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/validate.js';

const router = Router();

function currentSub(userId) {
  return db.prepare(
    `SELECT * FROM subscriptions WHERE user_id = ? ORDER BY sub_id DESC LIMIT 1`
  ).get(userId);
}

function subscriptionView(user) {
  const sub = currentSub(user.user_id);
  return {
    plan_type: user.plan_type,
    plan_tier: user.plan_tier || null,
    billing_cycle: user.billing_cycle || null,
    subscription_status: user.subscription_status,
    token_balance: user.token_balance ?? 0,
    renewal_date: sub?.end_date || null,
    access_until: sub?.end_date || null,
    data_delete_at: sub?.data_delete_at || null,
    cancel_at_period_end: !!sub?.cancel_at_period_end,
    sub_status: sub?.status || null,
  };
}

function canUpgrade(user) {
  if (user.plan_tier && user.billing_cycle && isBestPlan(user.plan_tier, user.billing_cycle)) {
    return false;
  }
  return true;
}

// GET /api/subscription/plans
router.get('/plans', requireUser, ah(async (req, res) => {
  const user = req.user;
  const sub = currentSub(user.user_id);
  const current = subscriptionView(user);
  const plans = buildPlanCatalog();
  const oneTimePacks = getOneTimePacks();

  const selectedMatches = (p) => {
    if (user.plan_type === 'Free' || current.sub_status === 'Expired') return false;
    if (current.plan_tier && current.billing_cycle) {
      return p.tier === current.plan_tier && p.cycle === current.billing_cycle;
    }
    if (user.plan_type === 'Monthly' && p.tier === 'Pro' && p.cycle === 'monthly') return true;
    if (user.plan_type === 'Annual' && p.tier === 'Pro' && p.cycle === 'annual') return true;
    return false;
  };

  res.json({
    plans: plans.map((p) => ({ ...p, isCurrent: selectedMatches(p) })),
    oneTimePacks,
    current,
    access: computeAccess(user),
    upgradeAvailable: canUpgrade(user),
    upgradeHidden: !canUpgrade(user),
  });
}));

// GET /api/subscription/me
router.get('/me', requireUser, ah(async (req, res) => {
  const sub = currentSub(req.user.user_id);
  res.json({ subscription: sub || null, current: subscriptionView(req.user), access: computeAccess(req.user) });
}));

function activate(userId, { tier, cycle }) {
  const tiers = getTierPricing();
  const t = tiers[tier];
  if (!t) throw new HttpError(400, 'Invalid plan tier');
  const tokens = t.tokens || 0;
  const planType = cycle === 'annual' ? 'Annual' : 'Monthly';

  const start = new Date();
  const end = new Date(start);
  if (cycle === 'annual') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  db.prepare(
    `INSERT INTO subscriptions (user_id, plan, plan_tier, billing_cycle, tokens_granted, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')`
  ).run(
    userId,
    planType,
    tier,
    cycle,
    tokens,
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  );

  db.prepare(
    `UPDATE users SET plan_type = ?, plan_tier = ?, billing_cycle = ?, subscription_status = 'Active',
     token_balance = COALESCE(token_balance, 0) + ? WHERE user_id = ?`
  ).run(planType, tier, cycle, tokens, userId);

  return { end, tokens };
}

// POST /api/subscription/subscribe  { tier, cycle }
router.post('/subscribe', requireUser, ah(async (req, res) => {
  const { tier, cycle, planId } = req.body || {};
  let resolvedTier = tier;
  let resolvedCycle = cycle;
  if (planId && typeof planId === 'string') {
    const [t, c] = planId.split('-');
    resolvedTier = t;
    resolvedCycle = c;
  }
  if (!['Starter', 'Pro', 'Expert'].includes(resolvedTier)) {
    throw new HttpError(400, 'Choose Starter, Pro, or Expert');
  }
  if (!['monthly', 'annual'].includes(resolvedCycle)) {
    throw new HttpError(400, 'Choose monthly or annual billing');
  }

  const { end, tokens } = activate(req.user.user_id, { tier: resolvedTier, cycle: resolvedCycle });
  audit('user', req.user.user_id, 'subscribe', { tier: resolvedTier, cycle: resolvedCycle });
  res.status(201).json({
    message: `Subscribed to ${resolvedTier} (${resolvedCycle})`,
    tier: resolvedTier,
    cycle: resolvedCycle,
    tokensAdded: tokens,
    renewalDate: end.toISOString().slice(0, 10),
    current: subscriptionView(db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.user_id)),
  });
}));

// POST /api/subscription/upgrade  { tier?, cycle?: 'annual', planId? }
router.post('/upgrade', requireUser, ah(async (req, res) => {
  const user = req.user;
  const { tier, cycle = 'annual', planId } = req.body || {};
  let resolvedTier = tier || user.plan_tier;
  let resolvedCycle = cycle;
  if (planId && typeof planId === 'string') {
    const [t, c] = planId.split('-');
    resolvedTier = t;
    resolvedCycle = c || 'annual';
  }
  if (!resolvedTier) throw new HttpError(400, 'Select a plan to upgrade to');

  if (isBestPlan(resolvedTier, resolvedCycle)) {
    const already = user.plan_tier === resolvedTier && user.billing_cycle === resolvedCycle;
    if (already) throw new HttpError(400, 'You are already on the highest plan');
  }

  const currentRank = tierRank(user.plan_tier);
  const targetRank = tierRank(resolvedTier);
  const upgradingTier = targetRank > currentRank;
  const monthlyToAnnual = user.billing_cycle === 'monthly' && resolvedCycle === 'annual'
    && resolvedTier === user.plan_tier;

  if (user.plan_type === 'Free') {
    throw new HttpError(400, 'Subscribe to a plan first');
  }
  if (!upgradingTier && !monthlyToAnnual && user.plan_tier === resolvedTier && user.billing_cycle === resolvedCycle) {
    throw new HttpError(400, 'You are already on this plan');
  }

  const { end, tokens } = activate(user.user_id, { tier: resolvedTier, cycle: resolvedCycle });
  audit('user', user.user_id, 'upgrade', { tier: resolvedTier, cycle: resolvedCycle });
  res.json({
    message: `Upgraded to ${resolvedTier} (${resolvedCycle})`,
    tier: resolvedTier,
    cycle: resolvedCycle,
    tokensAdded: tokens,
    renewalDate: end.toISOString().slice(0, 10),
    current: subscriptionView(db.prepare('SELECT * FROM users WHERE user_id = ?').get(user.user_id)),
  });
}));

// POST /api/subscription/purchase  { packId }
router.post('/purchase', requireUser, ah(async (req, res) => {
  const { packId } = req.body || {};
  const pack = getOneTimePacks().find((p) => p.id === packId);
  if (!pack) throw new HttpError(400, 'Invalid token pack');

  db.prepare('UPDATE users SET token_balance = COALESCE(token_balance, 0) + ? WHERE user_id = ?')
    .run(pack.tokens, req.user.user_id);
  audit('user', req.user.user_id, 'token_purchase', { packId, tokens: pack.tokens });

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.user_id);
  res.status(201).json({
    message: `Purchased ${pack.tokens} tokens`,
    tokensAdded: pack.tokens,
    token_balance: user.token_balance,
  });
}));

// POST /api/subscription/cancel
router.post('/cancel', requireUser, ah(async (req, res) => {
  const sub = currentSub(req.user.user_id);
  if (!sub || sub.status !== 'Active') throw new HttpError(400, 'No active subscription to cancel');
  const retentionDays = Number(getSetting('data_retention_days')) || config.dataRetentionDays;
  const dataDeleteAt = new Date(new Date(sub.end_date).getTime() + retentionDays * 86400000)
    .toISOString().slice(0, 10);

  db.prepare(
    `UPDATE subscriptions SET cancel_at_period_end = 1, status = 'Cancelled', data_delete_at = ? WHERE sub_id = ?`
  ).run(dataDeleteAt, sub.sub_id);

  audit('user', req.user.user_id, 'cancel_subscription', { termEnd: sub.end_date, dataDeleteAt });
  res.json({
    message: 'Subscription cancelled.',
    noRefund: true,
    accessUntil: sub.end_date,
    dataSelfDeletionDate: dataDeleteAt,
    note: `You keep access until ${sub.end_date}. No refunds are issued. Your data will be deleted on ${dataDeleteAt} unless you re-subscribe before then.`,
    current: subscriptionView(db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.user_id)),
  });
}));

export default router;
