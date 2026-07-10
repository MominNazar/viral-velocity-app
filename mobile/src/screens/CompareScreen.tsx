import React from 'react';
import { View, Text, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParams } from '../navigation/types';
import { ScoreBadge, AppScrollView } from '../components/UI';
type Props = NativeStackScreenProps<AppStackParams, 'Compare'>;

export function CompareScreen({ route }: Props) {
  const { original, enhanced } = route.params;
  const delta = (enhanced.score ?? 0) - (original.score ?? 0);

  return (
    <AppScrollView className="bg-bg">
      <Text className="text-text text-xl font-bold mb-4">Side-by-Side</Text>

      <View className="flex-row gap-3">
        <Pane label="Original" url={original.url} score={original.score} />
        <Pane label={`Enhanced v${enhanced.version_number}`} url={enhanced.url} score={enhanced.score} />
      </View>

      <View className="bg-surface border border-border rounded-2xl p-4 mt-5 items-center">
        <Text className="text-muted">Score change</Text>
        <Text className={`text-2xl font-bold mt-1 ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
          {delta >= 0 ? '+' : ''}{delta} points
        </Text>
      </View>
    </AppScrollView>
  );
}
function Pane({ label, url, score }: { label: string; url: string | null; score: number | null }) {
  return (
    <View className="flex-1">
      <Text className="text-muted text-center mb-2">{label}</Text>
      <View className="relative">
        {url ? (
          <Image source={{ uri: url }} className="w-full rounded-2xl" style={{ aspectRatio: 1 }} />
        ) : (
          <View className="w-full rounded-2xl bg-surface2 items-center justify-center" style={{ aspectRatio: 1 }}><Text className="text-4xl">🖼</Text></View>
        )}
        <View className="absolute top-2 right-2"><ScoreBadge score={score} size="sm" /></View>
      </View>
    </View>
  );
}
