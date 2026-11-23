"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Eye, EyeOff, FileSpreadsheet, Loader2, LogIn, Send } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { ThemeToggle } from "./ThemeToggle";
import { MIN_PASSWORD } from "@/lib/validate";

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
        let last = "";
        try {
          last = localStorage.getItem(LAST_KEY) ?? "";
        } catch {}
        setUserId(j.data.users.find((u: Person) => u.id === last)?.id ?? j.data.users[0]?.id ?? "");
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
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel (large screens) */}
      <aside className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16" style={{ background: "linear-gradient(135deg, #0a5566 0%, #0b6a8c 55%, #0f78b0 100%)" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.55) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "linear-gradient(to bottom right, black 0%, transparent 75%)",
            WebkitMaskImage: "linear-gradient(to bottom right, black 0%, transparent 75%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"><Clock className="h-5 w-5" strokeWidth={2.4} /></span>
          <span className="text-lg font-semibold tracking-tight">TimeTrack</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Log the week.<br />Get paid on time.</h2>
          <p className="mt-4 text-base text-white/80">A timesheet that works like your spreadsheet, with weekly submit, review and export built in.</p>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              [Clock, "Type hours straight into the grid — it saves as you go"],
              [Send, "Submit a whole week, or just the days you pick"],
              [CheckCircle2, "Your accountant approves it by the week"],
              [FileSpreadsheet, "Exports to QuickBooks and the Excel timesheet"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Clock;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20"><I className="h-4 w-4" /></span>
                  <span className="text-white/90">{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Apex Engineering</p>
      </aside>

      {/* Sign-in */}
      <main className="relative flex items-center justify-center bg-background px-4 py-10">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <form onSubmit={submit} className="relative w-full max-w-sm animate-m3-in space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
          <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-md lg:hidden">
            <span className="absolute inset-0" style={{ background: "var(--fab-gradient)" }} />
            <Clock className="relative h-6 w-6 text-white" strokeWidth={2.4} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{needsSetup ? "Set up TimeTrack" : "Sign in to TimeTrack"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsSetup ? "Create the first admin account to get started." : "Pick your name and enter your password."}
            </p>
          </div>
        </div>

        {people === null ? (
          error ? null : <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
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
              <label className="block space-y-1.5">
                <span className="m3-label">Who are you?</span>
                <select
                  aria-label="Who are you?"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className={`${field} m3-select cursor-pointer appearance-none pr-10`}
                >
                  {people?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.role}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-1.5">
              <span className="m3-label">{needsSetup ? `Choose a password (${MIN_PASSWORD}+ characters)` : "Password"}</span>
              <div className="relative">
                <input
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
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
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
    </div>
  );
}
