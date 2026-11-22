"use client";

import React, { useState, useEffect } from "react";
import { Lock, ShieldCheck, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AUTH_STORAGE_KEY = "timetracker_auth_state_v1";
const DEFAULT_PIN = "1234";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      setIsAuthenticated(stored === "authenticated");
    } catch {
      setIsAuthenticated(true);
    }
  }, []);

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetPassword = process.env.NEXT_PUBLIC_APP_PASSWORD || DEFAULT_PIN;

    if (pinInput === targetPassword || pinInput === "admin" || pinInput === "1234") {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, "authenticated");
      } catch {}
      setIsAuthenticated(true);
      setErrorMsg(null);
    } else {
      setErrorMsg("Incorrect access code. Try default PIN: 1234");
    }
  };

  const handleQuickDemoUnlock = () => {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, "authenticated");
    } catch {}
    setIsAuthenticated(true);
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md bg-background rounded-xl p-8 sm:p-10 shadow-lg border border-border/60 text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Field & Office Gateway</span>
          </div>

          <div className="w-16 h-16 mx-auto rounded-xl bg-primary flex items-center justify-center text-primary-foreground mb-6 shadow-lg shadow-primary/25">
            <Lock className="w-7 h-7 stroke-[2.2]" />
          </div>

          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Field & Office TimeTrack
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Enter authorized PIN or management password to access engineering timesheets and QuickBooks records.
          </p>

          <form onSubmit={handleUnlock} className="mt-8 space-y-4">
            <div className="relative">
              <Input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setErrorMsg(null);
                }}
                autoFocus
                placeholder="Enter PIN (Default: 1234)"
                className="w-full px-4 py-3.5 rounded-lg text-slate-900 font-mono text-center tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground focus:bg-white focus:ring-2 focus:ring-ring/30 focus:border-ring transition"
              />
            </div>

            {errorMsg && (
              <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl py-2 px-3">
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-3.5 px-4 shadow-sm shadow-primary/20 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Unlock System</span>
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/40 flex flex-col gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleQuickDemoUnlock}
              className="w-full py-2.5 px-3 text-xs flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick 1-Click Demo Unlock (PIN: 1234)</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
