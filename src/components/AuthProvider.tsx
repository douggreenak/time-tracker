"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { UserItem } from "@/db/mock-data";
import { AccessDenied } from "./AccessDenied";

interface AuthCtx {
  user: UserItem | null;
  loading: boolean;
  isManager: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, isManager: false, isAdmin: false, refresh: async () => {}, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const j = await fetch("/api/auth/me").then((r) => r.json());
      setUser(j.success ? j.data : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // If the session expires mid-use, any 401 sends the person back to sign in.
  useEffect(() => {
    const original = window.fetch;
    const wrapped: typeof window.fetch = async (...args) => {
      const res = await original(...args);
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
      if (res.status === 401 && url.includes("/api/") && !url.includes("/api/auth/")) setUser(null);
      return res;
    };
    window.fetch = wrapped;
    return () => {
      if (window.fetch === wrapped) window.fetch = original;
    };
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, isManager: !!user && (user.role === "accountant" || user.role === "admin"), isAdmin: user?.role === "admin", refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

/** Wraps a page that only accountants and admins may use. */
export function RequireManager({ children }: { children: React.ReactNode }) {
  const { isManager } = useAuth();
  return isManager ? <>{children}</> : <AccessDenied />;
}

/** Wraps a page that only admins may use. */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <AccessDenied />;
}
