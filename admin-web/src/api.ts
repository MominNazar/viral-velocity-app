const TOKEN_KEY = 'vv_admin_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),
  set: (t: string, remember: boolean) => {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;
  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth) {
    const t = tokenStore.get();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    tokenStore.clear();
    if (!path.startsWith('/admin/login') && !path.startsWith('/admin/verify-2fa')) {
      window.location.hash = '#/login';
    }
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || 'Request failed', data?.details);
  }
  return data as T;
}

export function downloadCsv(path: string, filename: string) {
  const t = tokenStore.get();
  return fetch(`/api${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
}
