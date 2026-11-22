"use client";

import { useEffect, useState } from "react";
import { Clock, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { ThemeToggle } from "./ThemeToggle";

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

  useEffect(() => {
    fetch("/api/auth/users")
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return setError("Can't reach the server. Try again in a moment.");
        setPeople(j.data.users);
        setIsDemo(j.data.isDemo);
        setNeedsSetup(j.data.needsSetup);
        let last = "";
        try {
          last = localStorage.getItem(LAST_KEY) ?? "";
        } catch {}
        setUserId(j.data.users.find((u: Person) => u.id === last)?.id ?? j.data.users[0]?.id ?? "");
      })
      .catch(() => setError("Can't reach the server. Try again in a moment."));
  }, []);

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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[44rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl" style={{ background: "var(--fab-gradient)" }} />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <form onSubmit={submit} className="relative w-full max-w-sm animate-m3-in space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-xl sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-md">
            <span className="absolute inset-0" style={{ background: "var(--fab-gradient)" }} />
            <Clock className="relative h-6 w-6 text-white" strokeWidth={2.4} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{needsSetup ? "Set up TimeTrack" : "Sign in to TimeTrack"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsSetup ? "Create the first admin account to get started." : "Pick your name and enter your password."}
            </p>
          </div>
        </div>

        {people === null && !error ? (
          <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
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
              <span className="m3-label">{needsSetup ? "Choose a password (8+ characters)" : "Password"}</span>
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
        {error && people === null && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
