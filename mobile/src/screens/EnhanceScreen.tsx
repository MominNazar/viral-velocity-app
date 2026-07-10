import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Dimensions, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { AppStackParams, Enhancement, Photo } from '../navigation/types';
import { Button, ScoreBadge, Field, Loading, useScreenInsets } from '../components/UI';
import { api, ApiError } from '../api/client';

type Props = NativeStackScreenProps<AppStackParams, 'Enhance'>;
type Nav = NativeStackNavigationProp<AppStackParams>;

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.28;

export function EnhanceScreen({ route }: Props) {
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const { photoId } = route.params;

  const [original, setOriginal] = useState<Photo | null>(null);
  const [stack, setStack] = useState<Enhancement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [promptBusy, setPromptBusy] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const { bottom } = useScreenInsets();

  useEffect(() => {
    (async () => {
      try {
        const detail = await api<{ photo: Photo }>(`/photos/${photoId}`);
        setOriginal(detail.photo);
        const gen = await api<{ enhancements: Enhancement[] }>(`/photos/${photoId}/enhance`, { method: 'POST', body: { count: 5 } });
        setStack(gen.enhancements);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to generate enhancements');
      } finally {
        setLoading(false);
      }
    })();
  }, [photoId]);

  function commit(state: 'saved' | 'discarded') {
    const top = stack[0];
    if (!top) return;
    const path = state === 'saved' ? 'save' : 'discard';
    api(`/photos/enhancements/${top.enhancement_id}/${path}`, { method: 'POST' }).catch(() => {});
    if (state === 'saved') setSavedCount((c) => c + 1);
    setStack((cur) => cur.slice(1));
    translateX.value = 0;
    translateY.value = 0;
    qc.invalidateQueries({ queryKey: ['photos'] });
  }

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(width * 1.5);
        runOnJS(commit)('saved');
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-width * 1.5);
        runOnJS(commit)('discarded');
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-width, width], [-12, 12], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP) }));
  const nopeStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP) }));

  async function submitPrompt() {
    if (!prompt.trim()) return;
    setPromptBusy(true);
    try {
      const top = stack[0];
      const r = await api<{ enhancements: Enhancement[]; appliedStyle?: string; notice?: string }>(`/photos/${photoId}/prompt`, {
        method: 'POST',
        body: { prompt: prompt.trim(), enhancementIds: top ? [top.enhancement_id] : [] },
      });
      setStack((cur) => [...r.enhancements, ...cur]);
      translateX.value = 0;
      translateY.value = 0;
      setPrompt('');
      setShowPrompt(false);
      qc.invalidateQueries({ queryKey: ['photos'] });
      const extra = [
        r.appliedStyle ? `Effect: ${r.appliedStyle}` : '',
        r.notice || '',
      ].filter(Boolean).join('\n\n');
      const suffix = extra ? `\n\n${extra}` : '';
      Alert.alert('Prompt applied', `${r.enhancements.length} new version(s) added on top of the stack. Swipe to review.${suffix}`);
    } catch (e) {
      Alert.alert('Error', e instanceof ApiError ? e.message : 'Prompt failed');
    } finally {
      setPromptBusy(false);
    }
  }

  if (loading) return <Loading label="Enhancing photos… this may take a moment" />;
  if (error) return (
    <View className="flex-1 bg-bg items-center justify-center p-6">
      <Text className="text-danger text-center mb-4">{error}</Text>
      <Button title="Go back" variant="secondary" onPress={() => nav.goBack()} />
    </View>
  );

  const top = stack[0];
  const next = stack[1];

  return (
    <View className="flex-1 bg-bg p-5" style={{ paddingBottom: bottom + 20 }}>
      <Text className="text-muted text-center mb-1">Swipe right to save · left to discard</Text>
      <Text className="text-muted text-center mb-4">{stack.length} left · {savedCount} saved</Text>

      <View className="flex-1 items-center justify-center">
        {!top ? (
          <View className="items-center">
            <Text className="text-text text-lg font-bold mb-2">All done!</Text>
            <Text className="text-muted mb-5 text-center">You reviewed every enhanced version. Saved ones are in your Library.</Text>
            <Button title="View Library" onPress={() => nav.navigate('Tabs')} />
          </View>
        ) : (
          <View className="w-full items-center" style={{ height: width }}>
            {next ? (
              <View className="absolute w-[88%] bg-surface border border-border rounded-3xl p-3" style={{ top: 16, transform: [{ scale: 0.95 }] }}>
                <CardBody enh={next} />
              </View>
            ) : null}
            <GestureDetector gesture={pan}>
              <Animated.View className="absolute w-[88%] bg-surface border border-border rounded-3xl p-3" style={topStyle}>
                <Animated.View style={likeStyle} className="absolute z-10 top-6 left-6 border-2 border-success rounded-lg px-3 py-1">
                  <Text className="text-success font-extrabold text-lg">SAVE</Text>
                </Animated.View>
                <Animated.View style={nopeStyle} className="absolute z-10 top-6 right-6 border-2 border-danger rounded-lg px-3 py-1">
                  <Text className="text-danger font-extrabold text-lg">DISCARD</Text>
                </Animated.View>
                <CardBody enh={top} />
              </Animated.View>
            </GestureDetector>
          </View>
        )}
      </View>

      {top ? (
        <View className="gap-3">
          {showPrompt ? (
            <View>
              <Field placeholder="Describe a further edit (e.g. warmer yellow tones)" value={prompt} onChangeText={setPrompt} />
              {promptBusy ? (
                <Text className="text-muted text-xs text-center mb-3">Applying prompt… this may take 15–30 seconds</Text>
              ) : null}
              <View className="flex-row gap-3">
                <Button title="Cancel" variant="ghost" className="flex-1" onPress={() => setShowPrompt(false)} disabled={promptBusy} />
                <Button title="Apply Prompt" className="flex-1" loading={promptBusy} onPress={submitPrompt} />
              </View>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <Button title="⇆ Compare" variant="secondary" className="flex-1"
                onPress={() => original && nav.navigate('Compare', { original, enhanced: top })} />
              <Button title="✎ Add Prompt" variant="secondary" className="flex-1" onPress={() => setShowPrompt(true)} />
            </View>
          )}
          <View className="flex-row gap-3">
            <Button title="✕ Discard" variant="danger" className="flex-1" onPress={() => commit('discarded')} />
            <Button title="♥ Save" className="flex-1" onPress={() => commit('saved')} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CardBody({ enh }: { enh: Enhancement }) {
  return (
    <View>
      <View className="relative">
        {enh.url ? (
          <Image source={{ uri: `${enh.url}?v=${enh.enhancement_id}` }} className="w-full rounded-2xl" style={{ aspectRatio: 1 }} />
        ) : (
          <View className="w-full rounded-2xl bg-surface2 items-center justify-center" style={{ aspectRatio: 1 }}><Text className="text-5xl">✦</Text></View>
        )}
        <View className="absolute top-3 right-3"><ScoreBadge score={enh.score} size="lg" /></View>
      </View>
      <Text className="text-text font-bold text-base mt-3">Version {enh.version_number} · Score {enh.score}</Text>
      {enh.prompt ? <Text className="text-muted text-xs mt-1">Prompt: {enh.prompt}</Text> : null}
    </View>
  );
}
