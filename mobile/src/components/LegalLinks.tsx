import React from 'react';
import { Linking, Text, View, Pressable } from 'react-native';
import { Checkbox } from './UI';
import { LEGAL_URLS } from '../config';

async function openLegal(url: string) {
  const can = await Linking.canOpenURL(url);
  if (can) await Linking.openURL(url);
}

type Props = {
  prefix?: string;
  checked?: boolean;
  onToggle?: () => void;
};

/** FR-2: tappable Terms & Privacy links (Sign-up + Settings). */
export function LegalConsentRow({ prefix = 'I agree to the', checked, onToggle }: Props) {
  return (
    <View className="flex-row items-start mb-1">
      {onToggle != null ? (
        <Pressable className="mr-2 mt-0.5" onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
          <Checkbox checked={!!checked} />
        </Pressable>
      ) : null}
      <Text className="text-muted flex-1">
        {prefix}{' '}
        <Text className="text-primary2 underline" onPress={() => openLegal(LEGAL_URLS.terms)}>
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text className="text-primary2 underline" onPress={() => openLegal(LEGAL_URLS.privacy)}>
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}
