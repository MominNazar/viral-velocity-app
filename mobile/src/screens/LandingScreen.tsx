import React from 'react';
import { View, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParams } from '../navigation/types';
import { Screen, Button } from '../components/UI';

type Props = NativeStackScreenProps<AuthStackParams, 'Landing'>;

export function LandingScreen({ navigation }: Props) {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <View className="w-20 h-20 rounded-2xl bg-primary items-center justify-center mb-6">
          <Text className="text-white text-4xl font-bold">V</Text>
        </View>
        <Text className="text-text text-3xl font-bold text-center">Viral Velocity Engine</Text>
        <Text className="text-muted text-base text-center mt-3 px-6">
          Score your photos for social media and enhance them with AI to boost your reach.
        </Text>
      </View>
      <View className="gap-3 pb-4">
        <Button title="Sign Up" onPress={() => navigation.navigate('SignUp')} />
        <Button title="Login" variant="secondary" onPress={() => navigation.navigate('Login')} />
      </View>
    </Screen>
  );
}
