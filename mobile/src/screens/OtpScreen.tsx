import React, { useState } from 'react';
import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParams } from '../navigation/types';
import { Screen, H1, P, Field, Button } from '../components/UI';
import { api, ApiError } from '../api/client';

type Props = NativeStackScreenProps<AuthStackParams, 'Otp'>;

export function OtpScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function proceed() {
    setError('');
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code');
    setBusy(true);
    try {
      await api('/auth/verify-reset-otp', { method: 'POST', auth: false, body: { email, otp } });
      navigation.navigate('ResetPassword', { email, otp });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.details?.otp || e.message);
      } else {
        setError('Could not verify code');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <H1>Enter code</H1>
      <P className="mt-1 mb-6">We sent a 6-digit code to {email}. (In dev it's printed to the API console.)</P>
      <Field
        label="6-digit OTP"
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        error={error}
      />
      <Button title="Continue" onPress={proceed} loading={busy} />
    </Screen>
  );
}
