import React, { forwardRef } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  TextInputProps, ViewProps, KeyboardAvoidingView, Platform, ScrollView,
  ScrollViewProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Bottom inset for Android 3-button nav (often reports 0 in Expo Go). */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 0);
  return {
    top: insets.top,
    bottom,
    scrollBottom: bottom + 24,
  };
}

export const AppScrollView = forwardRef<ScrollView, ScrollViewProps>(function AppScrollView({
  contentContainerStyle,
  style,
  ...rest
}, ref) {
  const { scrollBottom } = useScreenInsets();
  return (
    <ScrollView
      ref={ref}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[{ padding: 20, paddingBottom: scrollBottom }, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      {...rest}
    />
  );
});

export function Screen({ children, scroll = false, className = '' }: { children: React.ReactNode; scroll?: boolean; className?: string }) {
  const { bottom, scrollBottom } = useScreenInsets();
  const inner = scroll ? (
    <ScrollView
      className={`flex-1 ${className}`}
      contentContainerStyle={{ padding: 20, paddingBottom: scrollBottom + 176, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 p-5 ${className}`} style={{ paddingBottom: bottom + 20 }}>{children}</View>
  );
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function H1({ children }: { children: React.ReactNode }) {
  return <Text className="text-text text-2xl font-bold">{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <Text className="text-text text-lg font-bold">{children}</Text>;
}
export function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-muted text-base ${className}`}>{children}</Text>;
}

export function Checkbox({ checked, className = '' }: { checked: boolean; className?: string }) {
  return (
    <View
      className={`w-5 h-5 rounded border items-center justify-center ${checked ? 'bg-primary border-primary' : 'border-border bg-transparent'} ${className}`}
    >
      {checked ? <Text className="text-white text-xs font-bold">✓</Text> : null}
    </View>
  );
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};
export function Button({ title, onPress, variant = 'primary', loading, disabled, className = '' }: BtnProps) {
  const bg = {
    primary: 'bg-primary',
    secondary: 'bg-surface2 border border-border',
    danger: 'bg-danger',
    ghost: 'bg-transparent',
  }[variant];
  const txt = variant === 'ghost' || variant === 'secondary' ? 'text-text' : 'text-white';
  const isOff = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      className={`rounded-xl px-4 py-3.5 items-center justify-center ${bg} ${isOff ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text className={`font-semibold text-base ${txt}`}>{title}</Text>}
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label?: string; error?: string };
export function Field({ label, error, className = '', ...rest }: FieldProps) {
  return (
    <View className="mb-4">
      {label ? <Text className="text-muted text-sm mb-1.5">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#5b6373"
        className={`bg-surface2 border ${error ? 'border-danger' : 'border-border'} rounded-xl px-3.5 py-3 text-text text-base ${className}`}
        {...rest}
      />
      {error ? <Text className="text-danger text-xs mt-1.5">{error}</Text> : null}
    </View>
  );
}

export function Card({ children, className = '', ...rest }: ViewProps & { className?: string }) {
  return (
    <View className={`bg-surface border border-border rounded-2xl p-4 ${className}`} {...rest}>
      {children}
    </View>
  );
}

export function ScoreBadge({ score, size = 'md' }: { score: number | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'w-10 h-10', md: 'w-14 h-14', lg: 'w-20 h-20' }[size];
  const txt = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }[size];
  const color = score == null ? 'bg-surface2' : score >= 75 ? 'bg-success' : score >= 50 ? 'bg-warn' : 'bg-danger';
  return (
    <View className={`${dims} rounded-full items-center justify-center ${color}`}>
      <Text className={`text-white font-bold ${txt}`}>{score ?? '—'}</Text>
    </View>
  );
}

const SUB_LABELS: Record<string, string> = {
  technical_quality: 'Technical Quality',
  composition: 'Composition',
  emotional_resonance: 'Emotional Resonance',
  storytelling: 'Storytelling',
  color_psychology: 'Color Psychology',
};

export function SubScores({ subScores }: { subScores: Record<string, number> | null }) {
  if (!subScores) return null;
  return (
    <View className="mt-2">
      {Object.entries(subScores).map(([k, v]) => (
        <View key={k} className="flex-row items-center justify-between py-2 border-b border-border">
          <Text className="text-muted text-sm">{SUB_LABELS[k] || k}</Text>
          <View className="flex-row items-center">
            <View className="w-24 h-1.5 bg-surface2 rounded-full mr-2 overflow-hidden">
              <View className="h-full bg-primary2" style={{ width: `${v}%` }} />
            </View>
            <Text className="text-text text-sm font-semibold w-7 text-right">{v}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color="#8b7dff" size="large" />
      <Text className="text-muted mt-3">{label}</Text>
    </View>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <View className="items-center justify-center py-16">
      <Text className="text-muted text-center">{label}</Text>
    </View>
  );
}
