import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, token } from '../api/client';
import { User } from '../navigation/types';

export type { User };

type AuthCtx = {
  user: User | null;
  booting: boolean;
  signIn: (token: string, user: User, remember: boolean) => Promise<void>;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await token.load();
      if (t) {
        try {
          const r = await api<{ user: User }>('/auth/me');
          setUser(r.user);
        } catch {
          await token.clear();
        }
      }
      setBooting(false);
    })();
  }, []);

  const signIn = async (t: string, u: User, remember: boolean) => {
    await token.set(t, remember);
    setUser(u);
  };

  const signOut = async () => {
    await token.clear();
    setUser(null);
  };

  const refresh = async () => {
    try {
      const r = await api<{ user: User }>('/auth/me');
      setUser(r.user);
    } catch {
      /* ignore */
    }
  };

  return <Ctx.Provider value={{ user, booting, signIn, setUser, signOut, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
