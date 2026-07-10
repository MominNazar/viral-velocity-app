import { Platform } from 'react-native';

// Backend base URL. localhost works on iOS simulator + web.
// Android emulator must use 10.0.2.2; a physical device needs your machine's LAN IP.
// Override by setting EXPO_PUBLIC_API_BASE in your environment.
const fromEnv = process.env.EXPO_PUBLIC_API_BASE;

const defaultHost = Platform.select({
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000',
});

const apiRoot = (fromEnv || defaultHost).replace(/\/$/, '');

export const API_BASE = `${apiRoot}/api`;
export const LEGAL_URLS = {
  terms: `${apiRoot}/legal/terms.html`,
  privacy: `${apiRoot}/legal/privacy.html`,
};
