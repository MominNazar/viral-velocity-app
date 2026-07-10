import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { fetch } from 'expo/fetch';
import { API_BASE } from '../config';

const TOKEN_KEY = 'vv_token';
const LAST_EMAIL_KEY = 'vv_last_email';
const REMEMBER_PREF_KEY = 'vv_remember';
let memToken: string | null = null;

export const credentials = {
  async loadLoginPrefs(): Promise<{ email: string; remember: boolean }> {
    const pairs = await AsyncStorage.multiGet([LAST_EMAIL_KEY, REMEMBER_PREF_KEY]);
    const map = Object.fromEntries(pairs);
    // Default Remember Me ON unless user explicitly turned it off
    const remember = map[REMEMBER_PREF_KEY] === undefined || map[REMEMBER_PREF_KEY] === null
      ? true
      : map[REMEMBER_PREF_KEY] === '1';
    return { email: map[LAST_EMAIL_KEY] || '', remember };
  },
  async saveLoginPrefs(email: string, remember: boolean) {
    await AsyncStorage.multiSet([
      [LAST_EMAIL_KEY, email.trim().toLowerCase()],
      [REMEMBER_PREF_KEY, remember ? '1' : '0'],
    ]);
  },
};

export const token = {
  async load() {
    memToken = await AsyncStorage.getItem(TOKEN_KEY);
    return memToken;
  },
  async set(t: string, _remember = true) {
    memToken = t;
    // Always persist so closing the app does not force re-login
    await AsyncStorage.setItem(TOKEN_KEY, t);
  },
  async clear() {
    memToken = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
  current: () => memToken,
};

export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;
  code?: string;
  constructor(status: number, message: string, details?: Record<string, string>, code?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && memToken) headers.Authorization = `Bearer ${memToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Network error. Check your connection and try again.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || 'Request failed', data?.details, data?.code || data?.details?.code);
  }
  return data as T;
}

/** Copy picker URIs to file:// cache paths the upload API can read. */
async function toFileUri(uri: string, index: number): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const dest = `${FileSystem.cacheDirectory}upload_${Date.now()}_${index}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

// SDK 56: RN FormData no longer accepts { uri, name, type } — use expo-file-system File + expo/fetch.
export async function uploadPhotos(uris: { uri: string; name: string; type: string }[]): Promise<any> {
  const form = new FormData();
  for (let i = 0; i < uris.length; i += 1) {
    const fileUri = await toFileUri(uris[i].uri, i);
    form.append('photos', new File(fileUri));
  }

  const headers: Record<string, string> = {};
  if (memToken) headers.Authorization = `Bearer ${memToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/photos/upload`, { method: 'POST', headers, body: form });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    throw new ApiError(0, `Network error during upload. (${detail})`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Upload failed', data?.details, data?.code);
  return data;
}
