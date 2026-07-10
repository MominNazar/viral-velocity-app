import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokenStore } from './api';

export type Admin = { admin_id: number; name: string; email: string; role: string; twofa_enabled: boolean };

type AuthCtx = {
  admin: Admin | null;
  loading: boolean;
  setAdmin: (a: Admin | null) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api<{ admin: Admin }>('/admin/me')
      .then((r) => setAdmin(r.admin))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    tokenStore.clear();
    setAdmin(null);
    window.location.hash = '#/login';
  };

  return <Ctx.Provider value={{ admin, loading, setAdmin, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
