import React, { useState } from 'react';
import { View, Text, Image, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParams } from '../navigation/types';
import { Button, ScoreBadge, SubScores, Card, AppScrollView } from '../components/UI';

type Props = NativeStackScreenProps<AppStackParams, 'Score'>;
type Nav = NativeStackNavigationProp<AppStackParams>;

export function ScoreScreen({ route }: Props) {
  const nav = useNavigation<Nav>();
  const { photos } = route.params;
  const [index, setIndex] = useState(route.params.index ?? 0);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

  const photo = photos[index];
  const hasNext = index < photos.length - 1;
  const hasPrev = index > 0;

  function goNext() {
    if (hasNext) { setIndex(index + 1); setExpanded(false); setSaved(false); }
  }
  function goPrev() {
    if (hasPrev) { setIndex(index - 1); setExpanded(false); setSaved(false); }
  }

  return (
    <AppScrollView className="bg-bg">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-muted">Image {index + 1} of {photos.length}</Text>
        {photos.length > 1 ? (
          <View className="flex-row gap-2">
            <Pressable onPress={goPrev} disabled={!hasPrev} className={`px-3 py-1.5 rounded-lg bg-surface2 ${!hasPrev ? 'opacity-30' : ''}`}>
              <Text className="text-text">←</Text>
            </Pressable>
            <Pressable onPress={goNext} disabled={!hasNext} className={`px-3 py-1.5 rounded-lg bg-surface2 ${!hasNext ? 'opacity-30' : ''}`}>
              <Text className="text-text">→</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="relative">
        {photo.url ? (
          <Image source={{ uri: photo.url }} className="w-full aspect-square rounded-2xl" />
        ) : (
          <View className="w-full aspect-square rounded-2xl bg-surface2 items-center justify-center"><Text className="text-5xl">🖼</Text></View>
        )}
        <View className="absolute top-3 right-3">
          <ScoreBadge score={photo.score} size="lg" />
        </View>
      </View>

      <Text className="text-text text-xl font-bold mt-4">Social Score: {photo.score}/100</Text>

      <Card className="mt-4">
        <Pressable className="flex-row items-center justify-between" onPress={() => setExpanded((e) => !e)}>
          <Text className="text-text font-semibold">Score Details</Text>
          <Text className="text-muted">{expanded ? '▲' : '▼'}</Text>
        </Pressable>
        {expanded ? <SubScores subScores={photo.sub_scores} /> : null}
      </Card>

      <View className="gap-3 mt-5">
        <Button title="✦  Enhance Photo" onPress={() => nav.navigate('Enhance', { photoId: photo.photo_id })} />
        <Button
          title={saved ? '✓ Saved to Library' : 'Save Original'}
          variant="secondary"
          disabled={saved}
          onPress={() => { setSaved(true); Alert.alert('Saved', 'Original saved to your Library.'); }}
        />
      </View>
    </AppScrollView>
  );
}
