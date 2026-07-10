import './global.css';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, View, Platform } from 'react-native';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { Loading } from './src/components/UI';
import { AuthStackParams, AppStackParams, TabParams, ProfileStackParams } from './src/navigation/types';

import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { OtpScreen } from './src/screens/OtpScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PhotoUploadScreen } from './src/screens/PhotoUploadScreen';
import { ScoreScreen } from './src/screens/ScoreScreen';
import { EnhanceScreen } from './src/screens/EnhanceScreen';
import { CompareScreen } from './src/screens/CompareScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ImageDetailScreen } from './src/screens/ImageDetailScreen';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ChangePasswordScreen } from './src/screens/ChangePasswordScreen';
import { useSystemChrome } from './src/hooks/useSystemChrome';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0f1117', card: '#181b24', text: '#e7e9ee', border: '#2a2f3c', primary: '#6d5efc' },
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const AppStack = createNativeStackNavigator<AppStackParams>();
const Tab = createBottomTabNavigator<TabParams>();

const screenHeader = { headerStyle: { backgroundColor: '#181b24' }, headerTintColor: '#e7e9ee', headerShadowVisible: false } as const;

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{label}</Text>
    </View>
  );
}

const ProfileStack = createNativeStackNavigator<ProfileStackParams>();

function ProfileTabs() {
  return (
    <ProfileStack.Navigator screenOptions={{ ...screenHeader, headerShown: false, contentStyle: { backgroundColor: '#0f1117' } }}>
      <ProfileStack.Screen name="Subscription" component={SubscriptionScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </ProfileStack.Navigator>
  );
}

function Tabs() {
  const insets = useSafeAreaInsets();
  const tabBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 0);
  return (
    <Tab.Navigator
      screenOptions={{
        ...screenHeader,
        tabBarStyle: {
          backgroundColor: '#181b24',
          borderTopColor: '#2a2f3c',
          height: 56 + tabBottom,
          paddingBottom: tabBottom,
        },
        tabBarActiveTintColor: '#8b7dff',
        tabBarInactiveTintColor: '#9aa3b2',
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} />, tabBarLabel: 'Home', headerShown: false }} />
      <Tab.Screen name="Gallery" component={GalleryScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="🖼" focused={focused} />, tabBarLabel: 'Gallery', headerShown: false }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="⭐" focused={focused} />, tabBarLabel: 'Library', headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileTabs} options={{ tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />, tabBarLabel: 'Profile', headerShown: false }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, booting } = useAuth();
  if (booting) return <Loading label="Starting Viral Velocity…" />;

  return (
    <NavigationContainer theme={navTheme}>
      {user ? (
        <AppStack.Navigator screenOptions={screenHeader}>
          <AppStack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <AppStack.Screen name="PhotoUpload" component={PhotoUploadScreen} options={{ title: 'Upload Photos' }} />
          <AppStack.Screen name="Score" component={ScoreScreen} options={{ title: 'Score' }} />
          <AppStack.Screen name="Enhance" component={EnhanceScreen} options={{ title: 'Enhance' }} />
          <AppStack.Screen name="Compare" component={CompareScreen} options={{ title: 'Side-by-Side' }} />
          <AppStack.Screen name="ImageDetail" component={ImageDetailScreen} options={{ title: 'Image Detail' }} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ ...screenHeader, headerShown: false }}>
          <AuthStack.Screen name="Landing" component={LandingScreen} />
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: '' }} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: true, title: '' }} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: true, title: 'Reset Password' }} />
          <AuthStack.Screen name="Otp" component={OtpScreen} options={{ headerShown: true, title: 'Enter OTP' }} />
          <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: true, title: 'New Password' }} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  useSystemChrome();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <Root />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
