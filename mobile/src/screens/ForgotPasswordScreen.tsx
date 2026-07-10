import React, { useState } from 'react';
import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParams } from '../navigation/types';
import { Screen, H1, P, Field, Button } from '../components/UI';
import { api, ApiError } from '../api/client';

type Props = NativeStackScreenProps<AuthStackParams, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter a valid email');
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', auth: false, body: { email } });
      navigation.navigate('Otp', { email });
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Screen scroll>
      <H1>Forgot password?</H1>
      <P className="mt-1 mb-6">Enter your email and we'll send a 6-digit code.</P>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} />
      <Button title="Send OTP" onPress={send} loading={busy} />
    </Screen>
  );
}
