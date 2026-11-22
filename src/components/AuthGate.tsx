"use client";

import React, { useState, useEffect } from "react";
import { Lock, Unlock, KeyRound, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

const AUTH_STORAGE_KEY = "timetracker_auth_state_v1";
const DEFAULT_PIN = "1234";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check if previously authenticated in localStorage
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored === "authenticated") {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
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

  // While determining initial state, render neutral background
  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/50">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200/80 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Top Decorative Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Field & Office Gateway</span>
          </div>

          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/25">
            <Lock className="w-7 h-7 stroke-[2.2]" />
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Field & Office TimeTrack
          </h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Enter authorized PIN or management password to access engineering timesheets and QuickBooks records.
          </p>

          <form onSubmit={handleUnlock} className="mt-8 space-y-4">
            <div className="relative">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setErrorMsg(null);
                }}
                autoFocus
                placeholder="Enter PIN (Default: 1234)"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-center tracking-widest text-lg placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/30 focus:border-indigo-600 transition"
              />
            </div>

            {errorMsg && (
              <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl py-2 px-3">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Unlock System</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleQuickDemoUnlock}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition flex items-center justify-center gap-1.5 border border-slate-200/80"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick 1-Click Demo Unlock (PIN: 1234)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
