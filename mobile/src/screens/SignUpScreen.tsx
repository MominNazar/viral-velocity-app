import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParams, User } from '../navigation/types';
import { Screen, H1, P, Field, Button, Card } from '../components/UI';
import { LegalConsentRow } from '../components/LegalLinks';
import { api, ApiError, credentials } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Props = NativeStackScreenProps<AuthStackParams, 'SignUp'>;

export function SignUpScreen({ }: Props) {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', dob: '' });
  const [acceptTos, setAcceptTos] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [parentalVisible, setParentalVisible] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (form.password.length < 8) errs.password = 'At least 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dob)) errs.dob = 'Use YYYY-MM-DD';
    if (!acceptTos) errs.acceptTos = 'You must accept the Terms & Privacy Policy';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function doSignup(parentalConsent: boolean) {
    setBusy(true); setFormError('');
    try {
      const r = await api<{ token: string; user: User }>('/auth/signup', {
        method: 'POST', auth: false, body: { ...form, acceptTos, parentalConsent },
      });
      await credentials.saveLoginPrefs(form.email, false);
      await signIn(r.token, r.user, false);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'PARENTAL_CONSENT_REQUIRED') { setParentalVisible(true); return; }
        setFormError(e.message);
        if (e.details) setErrors(e.details);
      }
    } finally { setBusy(false); }
  }

  function submit() {
    setFormError('');
    if (!validate()) return;
    doSignup(false);
  }

  return (
    <Screen scroll>
      <H1>Create account</H1>
      <P className="mt-1 mb-6">Start your free trial: 5 photos in 30 days</P>
      <Field label="Full Name" value={form.name} onChangeText={set('name')} error={errors.name} />
      <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry error={errors.password} />
      <Field label="Confirm Password" value={form.confirmPassword} onChangeText={set('confirmPassword')} secureTextEntry error={errors.confirmPassword} />
      <Field label="Date of Birth (YYYY-MM-DD)" value={form.dob} onChangeText={set('dob')} placeholder="1998-05-20" error={errors.dob} />

      <LegalConsentRow checked={acceptTos} onToggle={() => setAcceptTos((v) => !v)} />
      {errors.acceptTos ? <Text className="text-danger text-xs mb-3">{errors.acceptTos}</Text> : <View className="mb-3" />}

      {formError ? <Text className="text-danger mb-3">{formError}</Text> : null}
      <Button title="Sign Up" onPress={submit} loading={busy} />

      <Modal transparent visible={parentalVisible} animationType="fade" onRequestClose={() => setParentalVisible(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <Card className="w-full">
            <Text className="text-text text-lg font-bold mb-2">Parental Supervision Required</Text>
            <Text className="text-muted mb-5">
              You're under 18. A parent or guardian must supervise your use of this app and agree to continue.
            </Text>
            <View className="gap-2">
              <Button title="Parent/Guardian Agrees" onPress={() => { setParentalVisible(false); doSignup(true); }} />
              <Button title="Cancel" variant="ghost" onPress={() => setParentalVisible(false)} />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
