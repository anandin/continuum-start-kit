import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, clearSession } from "@/lib/api";

export interface HavenUser {
  id: string;
  email: string;
}

interface AuthState {
  user: HavenUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<HavenUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: HavenUser }>("/api/auth/session");
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: HavenUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: HavenUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network failure on sign-out — we still clear locally
    }
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signUp, signOut, refresh }),
    [user, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
