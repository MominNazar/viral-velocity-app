import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileStackParams } from '../navigation/types';
import { Field, Button, useScreenInsets } from '../components/UI';
import { AppTopBar } from '../components/ProfileChrome';
import { api, ApiError } from '../api/client';

type Nav = NativeStackNavigationProp<ProfileStackParams>;

export function ChangePasswordScreen() {
  const nav = useNavigation<Nav>();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const { scrollBottom } = useScreenInsets();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErrors({});
    setFormError('');
    const errs: Record<string, string> = {};
    if (!form.currentPassword) errs.currentPassword = 'Required';
    if (form.newPassword.length < 8) errs.newPassword = 'At least 8 characters';
    if (form.newPassword !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: form });
      Alert.alert('Done', 'Password changed. A confirmation email was sent.', [{ text: 'OK', onPress: () => nav.navigate('Settings') }]);
    } catch (e) {
      if (e instanceof ApiError) {
        setFormError(e.message);
        if (e.details) setErrors(e.details);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: scrollBottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppTopBar title="Change Password" />
          <Text className="text-muted mb-5">Enter your current and new password.</Text>

          <Field label="Current Password" placeholder="Enter current password" value={form.currentPassword} onChangeText={set('currentPassword')} secureTextEntry error={errors.currentPassword} />
          <Field label="Password" placeholder="Enter new password" value={form.newPassword} onChangeText={set('newPassword')} secureTextEntry error={errors.newPassword} />
          <Field label="Confirm Password" placeholder="Confirm new password" value={form.confirmPassword} onChangeText={set('confirmPassword')} secureTextEntry error={errors.confirmPassword} />
          {formError ? <Text className="text-danger mb-3">{formError}</Text> : null}
          <Button title="Save" onPress={submit} loading={busy} />

          <View className="gap-3 mt-6">
            <Button title="⚙ General Settings" variant="secondary" onPress={() => nav.navigate('Settings')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
