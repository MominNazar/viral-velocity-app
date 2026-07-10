import React from 'react';
import { View, Text, FlatList, Image, Pressable, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { AppStackParams, Photo } from '../navigation/types';
import { Empty, Loading, ScoreBadge, useScreenInsets } from '../components/UI';
import { TokenBalance } from '../components/TokenBalance';

type Nav = NativeStackNavigationProp<AppStackParams>;

export function GalleryScreen() {
  const nav = useNavigation<Nav>();
  const { scrollBottom } = useScreenInsets();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['photos', 'gallery'],
    queryFn: () => api<{ photos: Photo[] }>('/photos?sort=date&order=desc'),
  });

  const photos = data?.photos ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Text className="text-text text-2xl font-bold">Gallery</Text>
        <TokenBalance />
      </View>
      {isLoading ? <Loading /> : (
        <FlatList
          data={photos}
          numColumns={2}
          keyExtractor={(p) => String(p.photo_id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: scrollBottom }}
          columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#8b7dff" />}
          ListEmptyComponent={<Empty label="No photos yet. Upload from Home." />}
          renderItem={({ item }) => (
            <Pressable
              className="flex-1 mb-3 bg-surface border border-border rounded-2xl overflow-hidden"
              onPress={() => nav.navigate('ImageDetail', { photoId: item.photo_id })}
            >
              {item.url ? (
                <Image source={{ uri: item.url }} className="w-full aspect-square" />
              ) : (
                <View className="w-full aspect-square items-center justify-center bg-surface2">
                  <Text className="text-3xl">🖼</Text>
                </View>
              )}
              <View className="p-2 flex-row items-center justify-between">
                <Text className="text-muted text-xs">#{item.photo_id}</Text>
                <ScoreBadge score={item.score} size="sm" />
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
