import React, { useState } from 'react';
import { View, Text, Image, Pressable, FlatList, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import { AppStackParams, LibraryItem } from '../navigation/types';
import { ScoreBadge, Empty, Loading, Button, Field, useScreenInsets } from '../components/UI';

type Nav = NativeStackNavigationProp<AppStackParams>;
type Sort = 'date' | 'score';
type Order = 'asc' | 'desc';
type Filter = 'all' | 'original' | 'enhanced';

export function LibraryScreen() {
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const [sort, setSort] = useState<Sort>('date');
  const [order, setOrder] = useState<Order>('desc');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const { bottom, scrollBottom } = useScreenInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['photos', 'library', sort, order, filter],
    queryFn: () => api<{ items: LibraryItem[] }>(`/photos/library?sort=${sort}&order=${order}&filter=${filter}`),
  });

  const items = data?.items ?? [];

  function toggleSelect(item: LibraryItem) {
    if (item.kind !== 'enhanced' || !item.enhancement_id) return;
    setSelected((cur) =>
      cur.includes(item.enhancement_id!)
        ? cur.filter((id) => id !== item.enhancement_id)
        : [...cur, item.enhancement_id!]
    );
  }

  function openItem(item: LibraryItem) {
    if (selectMode && item.kind === 'enhanced') {
      toggleSelect(item);
      return;
    }
    nav.navigate('ImageDetail', { photoId: item.photo_id });
  }

  async function submitBatchPrompt() {
    if (!prompt.trim()) return;
    if (selected.length < 1) {
      Alert.alert('Select images', 'Select one or more saved enhanced images first.');
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ count: number }>('/photos/library/prompt', {
        method: 'POST',
        body: { prompt: prompt.trim(), enhancementIds: selected },
      });
      setPrompt('');
      setShowPrompt(false);
      setSelected([]);
      setSelectMode(false);
      qc.invalidateQueries({ queryKey: ['photos'] });
      Alert.alert('Done', `${r.count} new prompted version(s) created. Open the photo to review them.`);
    } catch (e) {
      Alert.alert('Error', e instanceof ApiError ? e.message : 'Prompt failed');
    } finally {
      setBusy(false);
    }
  }

  const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} className={`px-3 py-1.5 rounded-full mr-2 ${active ? 'bg-primary' : 'bg-surface2 border border-border'}`}>
      <Text className={active ? 'text-white text-sm font-semibold' : 'text-muted text-sm'}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-text text-2xl font-bold">Library</Text>
          <Pressable
            onPress={() => {
              setSelectMode((m) => !m);
              setSelected([]);
              setShowPrompt(false);
            }}
            className="px-3 py-1.5 rounded-full bg-surface2 border border-border"
          >
            <Text className="text-primary2 text-sm font-semibold">{selectMode ? 'Done' : 'Select'}</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center mb-2">
          <Chip active={filter === 'all'} label="All" onPress={() => setFilter('all')} />
          <Chip active={filter === 'original'} label="Originals" onPress={() => setFilter('original')} />
          <Chip active={filter === 'enhanced'} label="Enhanced" onPress={() => setFilter('enhanced')} />
        </View>

        <View className="flex-row items-center mb-4">
          <Chip active={sort === 'score'} label="By Score" onPress={() => setSort('score')} />
          <Chip active={sort === 'date'} label="By Date" onPress={() => setSort('date')} />
          <View className="flex-1" />
          <Pressable onPress={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))} className="px-3 py-1.5 rounded-full bg-surface2 border border-border">
            <Text className="text-muted text-sm">{order === 'desc' ? '↓ Desc' : '↑ Asc'}</Text>
          </Pressable>
        </View>

        {selectMode ? (
          <Text className="text-muted text-sm mb-2">
            Tap saved enhanced images to select · {selected.length} selected
          </Text>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.enhancement_id ?? item.photo_id}`}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 12, paddingBottom: (selectMode && selected.length) || showPrompt ? 160 + bottom : scrollBottom }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#8b7dff" />}
        ListEmptyComponent={isLoading ? <Loading /> : <Empty label="Your Library is empty." />}
        renderItem={({ item }) => {
          const isSelected = item.enhancement_id != null && selected.includes(item.enhancement_id);
          const selectable = selectMode && item.kind === 'enhanced';
          return (
            <Pressable
              className={`flex-1 bg-surface border rounded-2xl p-2 ${isSelected ? 'border-primary' : 'border-border'} ${selectable ? '' : selectMode && item.kind === 'original' ? 'opacity-50' : ''}`}
              onPress={() => openItem(item)}
            >
              <View className="relative">
                {item.url ? (
                  <Image source={{ uri: item.url }} className="w-full rounded-xl" style={{ aspectRatio: 1 }} />
                ) : (
                  <View className="w-full rounded-xl bg-surface2 items-center justify-center" style={{ aspectRatio: 1 }}>
                    <Text className="text-3xl">{item.kind === 'enhanced' ? '✦' : '🖼'}</Text>
                  </View>
                )}
                <View className="absolute top-1.5 right-1.5"><ScoreBadge score={item.score} size="sm" /></View>
                {isSelected ? (
                  <View className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white text-xs font-bold">✓</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-muted text-xs mt-2">
                {new Date(item.date).toLocaleDateString()} · {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

      {(selectMode && selected.length > 0) || showPrompt ? (
        <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-border px-4 pt-4" style={{ paddingBottom: bottom + 16 }}>
          {showPrompt ? (
            <View>
              <Field placeholder="Describe further edits for selected images" value={prompt} onChangeText={setPrompt} />
              <View className="flex-row gap-3 mt-2">
                <Button title="Cancel" variant="ghost" className="flex-1" onPress={() => setShowPrompt(false)} />
                <Button title="Submit Prompt" className="flex-1" loading={busy} onPress={submitBatchPrompt} />
              </View>
            </View>
          ) : (
            <Button title={`✎ Add Prompt (${selected.length} selected)`} onPress={() => setShowPrompt(true)} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
