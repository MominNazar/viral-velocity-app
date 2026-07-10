import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileStackParams } from '../navigation/types';
import { Card, Field, Button, useScreenInsets } from '../components/UI';
import { AppTopBar, ProfileSectionNav } from '../components/ProfileChrome';
import { LegalConsentRow } from '../components/LegalLinks';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Nav = NativeStackNavigationProp<ProfileStackParams>;

export function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const { user, signOut, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [tos, setTos] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { scrollBottom } = useScreenInsets();

  async function save() {
    setErr('');
    if (!tos) return setErr('Please confirm Terms & Privacy to save.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr('Enter a valid email');
    if (!name.trim()) return setErr('Full name is required');
    setBusy(true);
    try {
      const r = await api<{ user: typeof user }>('/auth/profile', { method: 'PUT', body: { name: name.trim(), email: email.trim() } });
      if (r.user) setUser(r.user);
      Alert.alert('Saved', 'Your profile changes were saved.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  }

  function disableProfile() {
    Alert.alert('Disable profile?', 'Your account will be disabled. Login credentials are retained, but you will not be able to use the app until support reactivates your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/auth/disable-profile', { method: 'POST' });
            await signOut();
            Alert.alert('Disabled', 'Your profile has been disabled.');
          } catch (e) {
            Alert.alert('Error', e instanceof ApiError ? e.message : 'Could not disable profile');
          }
        },
      },
    ]);
  }

  function logout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => signOut() },
    ]);
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
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <AppTopBar title="Settings" />
          <ProfileSectionNav active="settings" />

          <Card>
            <Field label="Full Name" placeholder="Enter Full Name" value={name} onChangeText={setName} />
            <Field label="Email" placeholder="Enter Email Address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <LegalConsentRow prefix="I agree to the" checked={tos} onToggle={() => setTos((t) => !t)} />
            {err ? <Text className="text-danger mb-3">{err}</Text> : null}
            <Button title="Save" onPress={save} loading={busy} />
          </Card>

          <View className="gap-3 mt-4">
            <Button title="Change Password" variant="secondary" onPress={() => nav.navigate('ChangePassword')} />
            <Button title="Disable Profile" variant="secondary" onPress={disableProfile} />
            <Button title="Logout" variant="danger" onPress={logout} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
