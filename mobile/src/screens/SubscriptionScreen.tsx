import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import { Card, Button, Loading, useScreenInsets } from '../components/UI';
import { AppTopBar, ProfileSectionNav } from '../components/ProfileChrome';
import { useAuth } from '../auth/AuthContext';

type Plan = {
  id: string;
  tier: string;
  cycle: 'monthly' | 'annual';
  tokens: number;
  popular?: boolean;
  price: number;
  discount: number;
  finalPrice: number;
  period: string;
  isCurrent?: boolean;
};

type OneTimePack = { id: string; label: string; tokens: number; price: number };

type PlansResp = {
  plans: Plan[];
  oneTimePacks: OneTimePack[];
  current: {
    plan_type: string;
    plan_tier: string | null;
    billing_cycle: string | null;
    subscription_status: string;
    token_balance: number;
    renewal_date: string | null;
    access_until: string | null;
    data_delete_at: string | null;
    cancel_at_period_end: boolean;
    sub_status: string | null;
  };
  upgradeAvailable: boolean;
  upgradeHidden: boolean;
};

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const isAnnual = plan.cycle === 'annual';
  const border = plan.isCurrent
    ? 'border-success'
    : selected
      ? 'border-primary'
      : isAnnual
        ? 'border-success/60'
        : 'border-border';

  return (
    <Pressable
      onPress={onSelect}
      className={`flex-1 bg-surface border-2 rounded-2xl p-3 mr-2 mb-3 ${border}`}
      accessibilityRole="button"
      accessibilityLabel={`${plan.tier} ${plan.cycle} ${plan.tokens} tokens`}
    >
      {isAnnual && plan.discount > 0 ? (
        <View className="bg-success self-start px-2 py-0.5 rounded mb-1">
          <Text className="text-bg text-[10px] font-bold">SALE {plan.discount}%</Text>
        </View>
      ) : plan.popular ? (
        <Text className="text-primary text-[10px] font-bold mb-1">Popular</Text>
      ) : (
        <View className="h-4 mb-1" />
      )}
      <Text className="text-text font-bold text-base">{plan.tier}</Text>
      <Text className="text-text font-extrabold text-lg mt-1">{plan.tokens.toLocaleString()} Tokens</Text>
      <View className="flex-row items-end mt-2 flex-wrap">
        {plan.discount > 0 ? (
          <Text className="text-muted line-through text-xs mr-1">${plan.price}</Text>
        ) : null}
        <Text className="text-text font-bold text-base">${plan.finalPrice}</Text>
        <Text className="text-muted text-xs mb-0.5">/{plan.period}</Text>
      </View>
      {plan.isCurrent ? (
        <Text className="text-success text-xs font-semibold mt-2">Current plan ✓</Text>
      ) : null}
    </Pressable>
  );
}

export function SubscriptionScreen() {
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const { scrollBottom } = useScreenInsets();
  const [mode, setMode] = useState<'subscription' | 'onetime'>('subscription');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api<PlansResp>('/subscription/plans'),
  });

  const tiers = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { monthly?: Plan; annual?: Plan }>();
    for (const p of data.plans) {
      const row = map.get(p.tier) || {};
      row[p.cycle] = p;
      map.set(p.tier, row);
    }
    return ['Starter', 'Pro', 'Expert'].map((tier) => ({ tier, ...map.get(tier) }));
  }, [data]);

  async function afterChange(message: string) {
    await refresh();
    qc.invalidateQueries({ queryKey: ['plans'] });
    await refetch();
    Alert.alert('Success', message);
  }

  async function runAction(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Error', e instanceof ApiError ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  function confirmUpgrade() {
    if (!selectedId || !data) {
      Alert.alert('Select a plan', 'Tap a plan card first, then tap Upgrade.');
      return;
    }
    const plan = data.plans.find((p) => p.id === selectedId);
    if (!plan) return;

    const isFree = data.current.plan_type === 'Free' || data.current.sub_status === 'Expired';
    const title = isFree ? 'Subscribe?' : 'Upgrade plan?';
    const body = `Proceed with ${plan.tier} (${plan.cycle}) for $${plan.finalPrice}/${plan.period}? Includes ${plan.tokens.toLocaleString()} tokens.`;

    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isFree ? 'Subscribe' : 'Upgrade',
        onPress: () => runAction(async () => {
          const endpoint = isFree ? '/subscription/subscribe' : '/subscription/upgrade';
          const r = await api<{ renewalDate: string; tokensAdded: number }>(endpoint, {
            method: 'POST',
            body: { planId: selectedId },
          });
          setSelectedId(null);
          await afterChange(
            `${isFree ? 'Subscribed' : 'Upgraded'} to ${plan.tier} (${plan.cycle}). +${r.tokensAdded} tokens. Renews ${r.renewalDate}.`,
          );
        }),
      },
    ]);
  }

  function cancel() {
    if (busy) return;
    Alert.alert(
      'Cancel subscription?',
      'No refunds are issued. You keep access until your term ends. After that, your data is scheduled for deletion unless you re-subscribe.',
      [
        { text: 'Keep plan', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: () => runAction(async () => {
            const r = await api<{ accessUntil: string; dataSelfDeletionDate: string }>('/subscription/cancel', { method: 'POST' });
            await afterChange(`Cancelled. Access until ${r.accessUntil}. Data deletion on ${r.dataSelfDeletionDate} unless you re-subscribe.`);
          }),
        },
      ],
    );
  }

  function buyPack(pack: OneTimePack) {
    if (busy) return;
    Alert.alert('Purchase tokens?', `${pack.label} for $${pack.price}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Buy',
        onPress: () => runAction(async () => {
          const r = await api<{ tokensAdded: number; token_balance: number }>('/subscription/purchase', {
            method: 'POST',
            body: { packId: pack.id },
          });
          await afterChange(`Added ${r.tokensAdded} tokens. Balance: ${r.token_balance.toLocaleString()}.`);
        }),
      },
    ]);
  }

  if (isLoading || !data) return <Loading label="Loading plans…" />;

  const cancelled = data.current.sub_status === 'Cancelled';
  const showCancel = data.current.plan_type !== 'Free'
    && data.current.sub_status === 'Active'
    && !data.current.cancel_at_period_end;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: scrollBottom }}>
        <AppTopBar title="Subscription" />
        <ProfileSectionNav active="subscription" />

        {cancelled ? (
          <Card className="mb-4 border-warn">
            <Text className="text-warn font-bold">Cancelled — access until {data.current.access_until}</Text>
            {data.current.data_delete_at ? (
              <Text className="text-muted text-sm mt-1">Data deletion scheduled: {data.current.data_delete_at}</Text>
            ) : null}
          </Card>
        ) : data.current.plan_tier ? (
          <Text className="text-muted mb-4">
            {data.current.plan_tier} · {data.current.billing_cycle}
            {data.current.renewal_date ? ` · renews ${data.current.renewal_date}` : ''}
          </Text>
        ) : (
          <Text className="text-muted mb-4">Free trial — choose a plan below</Text>
        )}

        <View className="flex-row bg-surface2 rounded-xl p-1 mb-5">
          {(['subscription', 'onetime'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-lg items-center ${mode === m ? 'bg-primary' : ''}`}
            >
              <Text className={`font-semibold text-sm ${mode === m ? 'text-white' : 'text-muted'}`}>
                {m === 'subscription' ? 'Subscription' : 'One-Time Purchase'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'subscription' ? (
          <>
            {tiers.map(({ tier, monthly, annual }) => (
              <View key={tier} className="flex-row">
                {monthly ? (
                  <PlanCard
                    plan={monthly}
                    selected={selectedId === monthly.id}
                    onSelect={() => setSelectedId(monthly.id)}
                  />
                ) : <View className="flex-1" />}
                {annual ? (
                  <PlanCard
                    plan={annual}
                    selected={selectedId === annual.id}
                    onSelect={() => setSelectedId(annual.id)}
                  />
                ) : <View className="flex-1" />}
              </View>
            ))}

            {!data.upgradeHidden ? (
              <Button
                title="Upgrade"
                className="mt-2"
                loading={busy}
                disabled={busy}
                onPress={confirmUpgrade}
              />
            ) : (
              <Text className="text-muted text-center mt-4 text-sm">You are on the best available plan.</Text>
            )}

            {showCancel ? (
              <Button title="Cancel Subscription" variant="ghost" className="mt-3" disabled={busy} onPress={cancel} />
            ) : null}
          </>
        ) : (
          <>
            {data.oneTimePacks.map((pack) => (
              <Card key={pack.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-text font-bold text-lg">{pack.label}</Text>
                    <Text className="text-muted text-sm mt-1">${pack.price}</Text>
                  </View>
                  <Button title="Buy" disabled={busy} loading={busy} onPress={() => buyPack(pack)} />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
