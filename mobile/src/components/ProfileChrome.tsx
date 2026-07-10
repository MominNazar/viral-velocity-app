import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParams } from '../navigation/types';
import { TokenBalance } from './TokenBalance';

type Nav = NativeStackNavigationProp<ProfileStackParams>;

export function ProfileSectionNav({ active }: { active: 'subscription' | 'settings' }) {
  const nav = useNavigation<Nav>();
  const items = [
    { key: 'subscription' as const, label: 'Subscription', screen: 'Subscription' as const },
    { key: 'settings' as const, label: 'Settings', screen: 'Settings' as const },
  ];

  return (
    <View className="flex-row bg-surface2 rounded-xl p-1 mb-4">
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => {
            if (active !== item.key) nav.navigate(item.screen);
          }}
          className={`flex-1 py-2.5 rounded-lg items-center ${active === item.key ? 'bg-primary' : ''}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === item.key }}
        >
          <Text className={`font-semibold text-sm ${active === item.key ? 'text-white' : 'text-muted'}`}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function AppTopBar({ title }: { title: string }) {
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-muted text-sm">Viral Velocity</Text>
        <TokenBalance />
      </View>
      <Text className="text-text text-2xl font-bold mt-2">{title}</Text>
    </View>
  );
}
