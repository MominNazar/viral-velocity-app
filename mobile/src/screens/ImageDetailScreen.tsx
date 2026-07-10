import React, { useRef, useState } from 'react';

import { View, Text, Image, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

import { useNavigation } from '@react-navigation/native';

import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { AppStackParams, Photo, Enhancement } from '../navigation/types';

import { Button, ScoreBadge, SubScores, Card, Loading, Field, AppScrollView } from '../components/UI';

import { api, ApiError } from '../api/client';



type Props = NativeStackScreenProps<AppStackParams, 'ImageDetail'>;

type Nav = NativeStackNavigationProp<AppStackParams>;



export function ImageDetailScreen({ route }: Props) {

  const nav = useNavigation<Nav>();

  const qc = useQueryClient();

  const scrollRef = useRef<ScrollView>(null);

  const { photoId } = route.params;

  const [expanded, setExpanded] = useState<number | null>(null);

  const [selected, setSelected] = useState<number[]>([]);

  const [showPrompt, setShowPrompt] = useState(false);

  const [prompt, setPrompt] = useState('');

  const [busy, setBusy] = useState(false);

  const [newIds, setNewIds] = useState<number[]>([]);



  const { data, isLoading, refetch } = useQuery({

    queryKey: ['photo', photoId],

    queryFn: () => api<{ photo: Photo; enhancements: Enhancement[] }>(`/photos/${photoId}`),

  });



  function toggleSelect(id: number) {

    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  }



  async function deletePhoto() {

    Alert.alert('Delete photo', 'Remove this photo and its versions from your Library?', [

      { text: 'Cancel', style: 'cancel' },

      {

        text: 'Delete', style: 'destructive', onPress: async () => {

          await api(`/photos/${photoId}`, { method: 'DELETE' });

          qc.invalidateQueries({ queryKey: ['photos'] });

          nav.goBack();

        },

      },

    ]);

  }



  async function deleteVersion(id: number) {

    await api(`/photos/enhancements/${id}`, { method: 'DELETE' }).catch(() => {});

    setNewIds((cur) => cur.filter((x) => x !== id));

    refetch();

  }



  async function submitPrompt() {

    if (!prompt.trim()) return;

    setBusy(true);

    try {

      const r = await api<{ enhancements: Enhancement[]; appliedStyle?: string; notice?: string }>(`/photos/${photoId}/prompt`, {

        method: 'POST',

        body: {

          prompt: prompt.trim(),

          enhancementIds: selected.length > 0 ? selected : [],

        },

      });

      const ids = r.enhancements.map((e) => e.enhancement_id);

      setPrompt('');

      setShowPrompt(false);

      setSelected([]);

      setNewIds(ids);

      await refetch();

      qc.invalidateQueries({ queryKey: ['photos'] });

      scrollRef.current?.scrollTo({ y: 0, animated: true });

      const extra = [
        r.appliedStyle ? `Effect: ${r.appliedStyle}` : '',
        r.notice || '',
      ].filter(Boolean).join('\n\n');
      const suffix = extra ? `\n\n${extra}` : '';

      Alert.alert(

        'Prompt applied',

        `${r.enhancements.length} new version(s) added at the top of the list. Scroll up to compare.${suffix}`,

      );

    } catch (e) {

      Alert.alert('Error', e instanceof ApiError ? e.message : 'Prompt failed');

    } finally {

      setBusy(false);

    }

  }



  if (isLoading || !data) return <Loading label={busy ? 'Applying prompt… this may take 15–30 seconds' : 'Loading…'} />;

  const { photo, enhancements } = data;



  return (

    <KeyboardAvoidingView

      className="flex-1 bg-bg"

      behavior={Platform.OS === 'ios' ? 'padding' : undefined}

      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}

    >

      <AppScrollView ref={scrollRef} className="bg-bg">

        <View className="relative">

          {photo.url ? (

            <Image source={{ uri: photo.url }} className="w-full rounded-2xl" style={{ aspectRatio: 1 }} />

          ) : (

            <View className="w-full rounded-2xl bg-surface2 items-center justify-center" style={{ aspectRatio: 1 }}><Text className="text-5xl">🖼</Text></View>

          )}

          <View className="absolute top-3 right-3"><ScoreBadge score={photo.score} size="lg" /></View>

        </View>

        <Text className="text-text text-lg font-bold mt-3">Original · Score {photo.score}</Text>



        <View className="flex-row gap-3 mt-4">

          <Button title="✦ Enhance" className="flex-1" onPress={() => nav.navigate('Enhance', { photoId })} />

          <Button title="🗑 Delete" variant="danger" className="flex-1" onPress={deletePhoto} />

        </View>



        <Text className="text-text text-lg font-bold mt-6 mb-1">Versions ({enhancements.length})</Text>

        {newIds.length > 0 ? (

          <Text className="text-success text-xs mb-2">New from your prompt — highlighted below</Text>

        ) : selected.length > 0 ? (

          <Text className="text-primary2 mb-2">{selected.length} selected as prompt source</Text>

        ) : (

          <Text className="text-muted text-xs mb-2">Tip: tap version(s) to prompt from those, or leave unselected to use the original.</Text>

        )}



        {enhancements.map((e) => (

          <Card

            key={e.enhancement_id}

            className={`mt-3 ${newIds.includes(e.enhancement_id) ? 'border-success' : selected.includes(e.enhancement_id) ? 'border-primary' : ''}`}

          >

            <Pressable className="flex-row items-center" onPress={() => toggleSelect(e.enhancement_id)}>

              {e.url ? (

                <Image source={{ uri: `${e.url}?v=${e.enhancement_id}` }} className="w-16 h-16 rounded-xl mr-3" />

              ) : (

                <View className="w-16 h-16 rounded-xl mr-3 bg-surface2 items-center justify-center"><Text className="text-2xl">✦</Text></View>

              )}

              <View className="flex-1">

                <Text className="text-text font-semibold">

                  Version {e.version_number}

                  {newIds.includes(e.enhancement_id) ? ' · NEW' : ''}

                </Text>

                <Text className={`text-xs mt-0.5 ${e.state === 'saved' ? 'text-success' : e.state === 'discarded' ? 'text-danger' : 'text-muted'}`}>

                  {e.state === 'saved' ? 'Passed (saved)' : e.state === 'discarded' ? 'Failed (discarded)' : 'Pending'}

                </Text>

                {e.prompt ? <Text className="text-muted text-xs mt-0.5" numberOfLines={2}>Prompt: {e.prompt}</Text> : null}

              </View>

              <ScoreBadge score={e.score} size="sm" />

            </Pressable>

            <View className="flex-row justify-between mt-3">

              <Pressable onPress={() => setExpanded(expanded === e.enhancement_id ? null : e.enhancement_id)}>

                <Text className="text-primary2 text-sm">{expanded === e.enhancement_id ? 'Hide details' : 'Score details'}</Text>

              </Pressable>

              <Pressable onPress={() => deleteVersion(e.enhancement_id)}>

                <Text className="text-danger text-sm">Delete</Text>

              </Pressable>

            </View>

            {expanded === e.enhancement_id ? <SubScores subScores={e.sub_scores} /> : null}

          </Card>

        ))}



        {enhancements.length === 0 ? <Text className="text-muted mt-2">No enhanced versions yet. Tap Enhance first, or apply a prompt from the original below.</Text> : null}



        <View className="mt-5">

          {busy ? (

            <View className="items-center py-4">

              <Loading label="Applying prompt… this may take 15–30 seconds" />

            </View>

          ) : showPrompt ? (

            <View>

              <Field placeholder="e.g. warmer yellow tones, brighter, more vibrant" value={prompt} onChangeText={setPrompt} />

              <View className="flex-row gap-3">

                <Button title="Cancel" variant="ghost" className="flex-1" onPress={() => setShowPrompt(false)} />

                <Button title="Apply Prompt" className="flex-1" loading={busy} onPress={submitPrompt} />

              </View>

            </View>

          ) : (

            <Button

              title="✎ Add Prompt for Further Edit"

              variant="secondary"

              onPress={() => {

                setShowPrompt(true);

                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

              }}

            />

          )}

        </View>

      </AppScrollView>

    </KeyboardAvoidingView>

  );

}

