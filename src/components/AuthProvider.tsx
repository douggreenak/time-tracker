"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { UserItem } from "@/db/mock-data";

interface AuthCtx {
  user: UserItem | null;
  loading: boolean;
  isManager: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, isManager: false, refresh: async () => {}, signOut: async () => {} });
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
    <Ctx.Provider value={{ user, loading, isManager: !!user && (user.role === "accountant" || user.role === "admin"), refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

/** Wraps a page that only accountants and admins may use. */
export function RequireManager({ children }: { children: React.ReactNode }) {
  const { isManager } = useAuth();
  if (isManager) return <>{children}</>;
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div>
        <p className="text-lg font-semibold">This page is for accountants and admins.</p>
        <p className="mt-1 text-sm text-muted-foreground">Ask an admin if you need access.</p>
      </div>
    </div>
  );
}
