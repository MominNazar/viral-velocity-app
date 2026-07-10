import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export function TokenBalance({ onPress }: { onPress?: () => void }) {
  const { user } = useAuth();
  const balance = user?.token_balance ?? 0;
  const inner = (
    <View className="flex-row items-center bg-surface2 border border-border rounded-full px-3 py-1.5">
      <Text className="text-primary text-sm mr-1">🪙</Text>
      <Text className="text-text font-bold text-sm">{balance.toLocaleString()}</Text>
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Token balance ${balance}`}>{inner}</Pressable>;
  }
  return inner;
}
