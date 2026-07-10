import React from 'react';
import { View, Text, Pressable, FlatList, Image, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { AppStackParams, Photo } from '../navigation/types';
import { Button, ScoreBadge, Empty, Loading, useScreenInsets } from '../components/UI';
import { TokenBalance } from '../components/TokenBalance';
import { useAuth } from '../auth/AuthContext';

type Nav = NativeStackNavigationProp<AppStackParams>;

export function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['photos', 'recent'],
    queryFn: () => api<{ photos: Photo[] }>('/photos?sort=date&order=desc'),
  });

  const trialRemaining = user && user.plan_type === 'Free' ? Math.max(0, 5 - user.trial_photos_used) : null;
  const { scrollBottom } = useScreenInsets();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <FlatList
        data={data?.photos ?? []}
        keyExtractor={(p) => String(p.photo_id)}
        contentContainerStyle={{ padding: 20, paddingBottom: scrollBottom }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#8b7dff" />}
        ListHeaderComponent={
          <View>
            <View className="flex-row items-center justify-between">
              <Text className="text-text text-2xl font-bold flex-1">Hi {user?.name?.split(' ')[0] || 'there'} 👋</Text>
              <TokenBalance />
            </View>
            {trialRemaining != null ? (
              <Text className="text-muted mt-1">Free trial · {trialRemaining} photo{trialRemaining === 1 ? '' : 's'} left</Text>
            ) : (
              <Text className="text-muted mt-1">{user?.plan_type} plan</Text>
            )}
            <View className="my-5">
              <Button title="＋  Upload Photos" onPress={() => nav.navigate('PhotoUpload')} />
            </View>
            <Text className="text-text text-lg font-bold mb-3">Recent Activity</Text>
            {isLoading ? <Loading /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            className="flex-row items-center bg-surface border border-border rounded-2xl p-3 mb-3"
            onPress={() => nav.navigate('ImageDetail', { photoId: item.photo_id })}
          >
            {item.url ? (
              <Image source={{ uri: item.url }} className="w-14 h-14 rounded-xl mr-3" />
            ) : (
              <View className="w-14 h-14 rounded-xl mr-3 bg-surface2 items-center justify-center"><Text className="text-2xl">🖼</Text></View>
            )}
            <View className="flex-1">
              <Text className="text-text font-semibold">Photo #{item.photo_id}</Text>
              <Text className="text-muted text-xs mt-0.5">{new Date(item.upload_date).toLocaleDateString()} · {item.status}</Text>
            </View>
            <ScoreBadge score={item.score} size="sm" />
          </Pressable>
        )}
        ListEmptyComponent={!isLoading ? <Empty label="No photos yet. Upload your first batch to get a Social Score." /> : null}
      />
    </SafeAreaView>
  );
}
