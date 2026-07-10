import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, FlatList, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { AppStackParams } from '../navigation/types';
import { Screen, H1, P, Button, Empty } from '../components/UI';
import { uploadPhotos, ApiError } from '../api/client';

type Nav = NativeStackNavigationProp<AppStackParams>;
type Picked = { uri: string; name: string; type: string };

const MAX = 5;

export function PhotoUploadScreen() {
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to select photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX,
      quality: 0.9,
    });
    if (result.canceled) return;
    const picks: Picked[] = result.assets.slice(0, MAX).map((a, i) => ({
      uri: a.uri,
      name: a.fileName || `photo_${Date.now()}_${i}.jpg`,
      type: a.mimeType || 'image/jpeg',
    }));
    if (picks.length > MAX) Alert.alert('Limit', `You can select up to ${MAX} photos.`);
    setSelected(picks);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (result.canceled) return;
    const a = result.assets[0];
    setSelected([{ uri: a.uri, name: a.fileName || `camera_${Date.now()}.jpg`, type: a.mimeType || 'image/jpeg' }]);
  }

  function toggleRemove(uri: string) {
    setSelected((cur) => cur.filter((p) => p.uri !== uri));
  }

  async function getScore() {
    if (selected.length < 1 || selected.length > MAX) return;
    setBusy(true);
    try {
      const r = await uploadPhotos(selected);
      qc.invalidateQueries({ queryKey: ['photos'] });
      if (r.blocked?.length) {
        Alert.alert('Some photos were blocked', `${r.blocked.length} image(s) failed content moderation and were not scored.`);
      }
      if (!r.photos?.length) { setBusy(false); return; }
      nav.replace('Score', { photos: r.photos, index: 0 });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Upload failed';
      Alert.alert('Upload error', msg);
    } finally {
      setBusy(false);
    }
  }

  const count = selected.length;
  const canScore = count >= 1 && count <= MAX;

  return (
    <Screen>
      <H1>Select photos</H1>
      <P className="mt-1 mb-4">Choose 1–{MAX} photos to score.</P>

      <View className="flex-row gap-3 mb-4">
        <Button title="🖼  Gallery" variant="secondary" className="flex-1" onPress={pickFromGallery} />
        <Button title="📷  Camera" variant="secondary" className="flex-1" onPress={takePhoto} />
      </View>

      {count === 0 ? (
        <Empty label="No photos selected yet." />
      ) : (
        <FlatList
          data={selected}
          keyExtractor={(p) => p.uri}
          numColumns={3}
          columnWrapperStyle={{ gap: 8 }}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <Pressable className="flex-1 max-w-[31%]" onPress={() => toggleRemove(item.uri)}>
              <Image source={{ uri: item.uri }} className="w-full aspect-square rounded-xl" />
              <View className="absolute top-1 right-1 w-6 h-6 rounded-full bg-success items-center justify-center">
                <Text className="text-white text-xs font-bold">✓</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <View className="mt-4">
        <Text className="text-muted text-center mb-2">{count}/{MAX} selected{count > 0 ? ' · tap a photo to remove' : ''}</Text>
        <Button title="Get Score" onPress={getScore} loading={busy} disabled={!canScore} />
      </View>
    </Screen>
  );
}
