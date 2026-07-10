import { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';

/** Match Android system nav button style to the dark app theme. */
export function useSystemChrome() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      // SDK 56+: setBackgroundColorAsync was removed; style controls button appearance.
      NavigationBar.setStyle('dark');
    } catch {
      /* unavailable in some Expo Go builds */
    }
  }, []);
}
