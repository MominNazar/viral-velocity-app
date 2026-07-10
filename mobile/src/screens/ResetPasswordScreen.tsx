import React, { useState } from 'react';
import { Text, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParams } from '../navigation/types';
import { Screen, H1, P, Field, Button } from '../components/UI';
import { api, ApiError } from '../api/client';

type Props = NativeStackScreenProps<AuthStackParams, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { email, otp } = route.params;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErrors({}); setFormError('');
    const errs: Record<string, string> = {};
    if (newPassword.length < 8) errs.newPassword = 'At least 8 characters';
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', auth: false, body: { email, otp, newPassword, confirmPassword } });
      Alert.alert('Success', 'Your password has been updated. Please log in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e) {
      if (e instanceof ApiError) { setFormError(e.message); if (e.details) setErrors(e.details); }
    } finally { setBusy(false); }
  }

  return (
    <Screen scroll>
      <H1>New password</H1>
      <P className="mt-1 mb-6">Choose a new password for {email}.</P>
      <Field label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry error={errors.newPassword} />
      <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={errors.confirmPassword} />
      {formError ? <Text className="text-danger mb-3">{formError}</Text> : null}
      <Button title="Reset Password" onPress={submit} loading={busy} />
    </Screen>
  );
}
