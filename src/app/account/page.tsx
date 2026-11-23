"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { MIN_PASSWORD } from "@/lib/validate";

const field =
  "h-11 w-full rounded-xl border border-outline-variant bg-surface-low px-4 text-sm outline-none transition-colors hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next.length < MIN_PASSWORD) return setMsg({ ok: false, text: `Use a new password of at least ${MIN_PASSWORD} characters.` });
    if (next !== again) return setMsg({ ok: false, text: "The two new passwords don't match." });
    if (next === cur) return setMsg({ ok: false, text: "Pick a password that's different from your current one." });
    setBusy(true);
    try {
      const j = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      }).then((r) => r.json());
      setMsg({ ok: !!j.success, text: j.success ? "Password changed. Use it the next time you sign in." : j.error || "Couldn't change it." });
      if (j.success) { setCur(""); setNext(""); setAgain(""); }
    } catch {
      setMsg({ ok: false, text: "Network error — check your connection." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Account</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Your details and password.</p>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt><dd className="font-medium">{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt><dd className="break-all">{user.email}</dd>
          <dt className="text-muted-foreground">Role</dt><dd className="capitalize">{user.role}</dd>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Need your name, email or role changed? Ask an admin.</p>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="h-4 w-4 text-muted-foreground" />Change password</h2>
        <form onSubmit={save} className="mt-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="m3-label">Current password</span>
            <input className={field} type={show ? "text" : "password"} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
          </label>
          <label className="block space-y-1.5">
            <span className="m3-label">New password</span>
            <input className={field} type={show ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD} placeholder={`At least ${MIN_PASSWORD} characters`} required />
          </label>
          <label className="block space-y-1.5">
            <span className="m3-label">Repeat new password</span>
            <input className={field} type={show ? "text" : "password"} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
          </label>
          <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{show ? "Hide" : "Show"} what I type
          </button>
          {msg && (
            <p role="alert" className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium", msg.ok ? "bg-tertiary-container text-tertiary-on-container" : "bg-destructive/10 text-destructive")}>
              {msg.ok && <Check className="h-4 w-4" />}{msg.text}
            </p>
          )}
          <button type="submit" disabled={busy} className="h-11 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60">
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">Passwords are stored scrambled, so nobody — not even an admin — can look yours up. If you forget it, an admin can set a new one for you.</p>
      </section>

      <button onClick={signOut} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full border border-outline-variant px-4 text-sm font-semibold text-destructive hover:bg-destructive/10">
        <LogOut className="h-4 w-4" />Sign out
      </button>
    </div>
  );
}
