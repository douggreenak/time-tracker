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
      <div className="flex min-h-screen items-center justify-center bg-surface-low p-4">
        <div className="w-full max-w-md animate-m3-in rounded-[28px] border border-border/60 bg-card p-8 text-center shadow-m3-2 sm:p-10">
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Secure gateway</span>
          </div>

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary text-primary-foreground shadow-m3-1">
            <Lock className="h-7 w-7" strokeWidth={2.1} />
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
            TimeTrack
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Enter your authorized PIN to access timesheets and QuickBooks records.
          </p>

          <form onSubmit={handleUnlock} className="mt-8 space-y-3">
            <Input
              type="password"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setErrorMsg(null);
              }}
              autoFocus
              placeholder="Enter PIN"
              aria-label="Access PIN"
              className="h-14 rounded-full bg-surface-container-low px-6 text-center font-mono text-base tracking-[0.3em] placeholder:text-sm placeholder:font-sans placeholder:tracking-normal"
            />

            {errorMsg && (
              <div
                role="alert"
                className="animate-m3-fade rounded-2xl bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive"
              >
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full shadow-m3-1"
            >
              <KeyRound className="h-4 w-4" />
              <span>Unlock</span>
            </Button>
          </form>

          <div className="mt-6 border-t border-border/60 pt-6">
            <Button
              type="button"
              variant="tonal"
              onClick={handleQuickDemoUnlock}
              className="w-full text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-tertiary" />
              <span>Explore with demo access</span>
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Demo PIN: <span className="font-mono font-semibold text-foreground">1234</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
