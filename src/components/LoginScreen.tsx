"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { ThemeToggle } from "./ThemeToggle";
import { MIN_PASSWORD } from "@/lib/validate";
import { Loader, Spinner } from "@/components/ui/loader";
import { Dropdown } from "@/components/ui/dropdown";

interface Person { id: string; name: string; role: string }

const LAST_KEY = "tt-last-login";
const field =
  "h-11 w-full rounded-xl border border-outline-variant bg-surface-low px-4 text-sm outline-none transition-colors hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25";

export function LoginScreen() {
  const { refresh } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tries, setTries] = useState(0);
  const pwRef = useRef<HTMLInputElement>(null);

  // The first visit after a deploy can take a while (database setup), so wait, retry, and then say what's wrong.
  useEffect(() => {
    let cancelled = false;
    const load = async (attempt: number) => {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 20000);
        const j = await fetch("/api/auth/users", { signal: ctl.signal, cache: "no-store" }).then((r) => r.json());
        clearTimeout(timer);
        if (cancelled) return;
        if (!j.success) throw new Error(j.error || "server error");
        setError(null);
        setPeople(j.data.users);
        setIsDemo(j.data.isDemo);
        setNeedsSetup(j.data.needsSetup);
        setUserId(""); // start blank: you choose who you are
      } catch (e) {
        if (cancelled) return;
        if (attempt < 3) return void setTimeout(() => load(attempt + 1), 2500);
        setError(e instanceof Error && e.name !== "AbortError" && e.message !== "server error" && !/JSON|fetch/i.test(e.message) ? e.message : "The server is taking too long or can't be reached.");
      }
    };
    setError(null);
    load(0);
    return () => {
      cancelled = true;
    };
  }, [tries]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!needsSetup && !userId) return setError("Select your name first.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(needsSetup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsSetup ? { name, email, password } : { userId, password }),
      });
      const j = await res.json();
      if (!j.success) {
        setError(j.error || "Couldn't sign in.");
        return;
      }
      try {
        localStorage.setItem(LAST_KEY, j.data.id);
      } catch {}
      await refresh();
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary/[0.08] via-background to-background px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <div className="flex flex-col items-center gap-3">
        <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-md">
          <span className="absolute inset-0" style={{ background: "var(--fab-gradient)" }} />
          <Clock className="relative h-7 w-7 text-white" strokeWidth={2.4} />
        </span>
        <span className="text-2xl font-semibold tracking-tight">TimeTrack</span>
      </div>

      <form onSubmit={submit} className="relative w-full max-w-sm animate-m3-in space-y-5 rounded-[28px] border border-border/70 bg-card p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-lg font-semibold tracking-tight">{needsSetup ? "Create the first admin account" : "Sign in"}</h1>

        {people === null ? (
          error ? null : <div className="flex justify-center py-6"><Loader size={40} /></div>
        ) : (
          <>
            {needsSetup ? (
              <>
                <label className="block space-y-1.5">
                  <span className="m3-label">Your name</span>
                  <input aria-label="Your name" className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                </label>
                <label className="block space-y-1.5">
                  <span className="m3-label">Email</span>
                  <input aria-label="Email" type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>
              </>
            ) : (
              <div className="block space-y-1.5">
                <span className="m3-label" id="who-label">Who are you?</span>
                <Dropdown
                  aria-label="Who are you?"
                  variant="field"
                  value={userId}
                  onChange={(v) => { setUserId(v); setTimeout(() => pwRef.current?.focus(), 0); }}
                  autoFocus
                  placeholder="Select your name"
                  options={(people ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.role }))}
                />
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="m3-label">{needsSetup ? `Choose a password (${MIN_PASSWORD}+ characters)` : "Password"}</span>
              <div className="relative">
                <input
                  ref={pwRef}
                  aria-label="Password"
                  type={show ? "text" : "password"}
                  className={`${field} pr-11`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={needsSetup ? "new-password" : "current-password"}
                  required
                />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={busy || (!needsSetup && !userId)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? <Spinner size={16} stroke="currentColor" /> : <LogIn className="h-4 w-4" />}
              {needsSetup ? "Create admin & continue" : "Sign in"}
            </button>

            {isDemo && !needsSetup && (
              <p className="rounded-lg bg-warning-container/50 px-3 py-2 text-center text-xs text-foreground">
                Sample data is loaded — every sample person’s password is <span className="font-mono font-semibold">demo1234</span>.
              </p>
            )}
          </>
        )}
        {error && people === null && (
          <div className="space-y-3 text-center">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <button type="button" onClick={() => setTries((n) => n + 1)} className="rounded-full border border-outline-variant px-4 py-1.5 text-xs font-semibold hover:bg-foreground/[0.05]">Try again</button>
          </div>
        )}
      </form>
    </main>
  );
}
