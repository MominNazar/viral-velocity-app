import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParams, User } from '../navigation/types';
import { Screen, H1, P, Field, Button, Checkbox } from '../components/UI';
import { api, ApiError, credentials } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Props = NativeStackScreenProps<AuthStackParams, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    credentials.loadLoginPrefs().then(({ email: savedEmail, remember: savedRemember }) => {
      if (savedEmail) setEmail(savedEmail);
      setRemember(savedRemember);
    });
  }, []);

  async function submit() {
    setErrors({}); setFormError('');
    const errs: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST', auth: false, body: { email, password, rememberMe: remember },
      });
      await credentials.saveLoginPrefs(email, remember);
      await signIn(r.token, r.user, remember);    } catch (e) {
      if (e instanceof ApiError) { setFormError(e.message); if (e.details) setErrors(e.details); }
    } finally { setBusy(false); }
  }

  return (
    <Screen scroll>
      <H1>Welcome back</H1>
      <P className="mt-1 mb-6">Log in to continue</P>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
      <Pressable className="flex-row items-center mb-2" onPress={() => setRemember((r) => !r)}>
        <Checkbox checked={remember} className="mr-2" />
        <Text className="text-muted">Remember me</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('ForgotPassword')} className="mb-5">
        <Text className="text-primary2">Forgot Password?</Text>
      </Pressable>
      {formError ? <Text className="text-danger mb-3">{formError}</Text> : null}
      <Button title="Login" onPress={submit} loading={busy} />
    </Screen>
  );
}
