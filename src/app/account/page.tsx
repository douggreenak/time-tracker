"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { MIN_PASSWORD } from "@/lib/validate";

const field =
  "h-11 w-full rounded-xl border border-outline-variant bg-surface-low px-4 text-sm outline-none transition-colors hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25";

export default function AccountPage() {
  const { user, signOut, refresh } = useAuth();
  const [pname, setPname] = useState("");
  const [pemail, setPemail] = useState("");
  const [pbusy, setPbusy] = useState(false);
  const [pmsg, setPmsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (user) { setPname(user.name); setPemail(user.email); }
  }, [user]);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) return null;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPmsg(null);
    if (!pname.trim() || !pemail.trim()) return setPmsg({ ok: false, text: "Name and email can't be empty." });
    setPbusy(true);
    try {
      const j = await fetch(`/api/users/${user!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pname.trim(), email: pemail.trim() }),
      }).then((r) => r.json());
      setPmsg({ ok: !!j.success, text: j.success ? "Saved." : j.error || "Couldn't save that." });
      if (j.success) await refresh();
    } catch {
      setPmsg({ ok: false, text: "Network error — check your connection." });
    } finally {
      setPbusy(false);
    }
  };

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
        <h2 className="text-base font-semibold">Your details</h2>
        <form onSubmit={saveProfile} className="mt-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="m3-label">Name</span>
            <input className={field} aria-label="Your name" value={pname} onChange={(e) => setPname(e.target.value)} autoComplete="name" required />
          </label>
          <label className="block space-y-1.5">
            <span className="m3-label">Email</span>
            <input className={field} aria-label="Your email" type="email" value={pemail} onChange={(e) => setPemail(e.target.value.toLowerCase())} autoComplete="email" autoCapitalize="none" required />
          </label>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold capitalize">{user.role}</span>
          </div>
          {pmsg && (
            <p role="status" className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium", pmsg.ok ? "bg-tertiary-container text-tertiary-on-container" : "bg-destructive/10 text-destructive")}>
              {pmsg.ok && <Check className="h-4 w-4" />}{pmsg.text}
            </p>
          )}
          <button type="submit" disabled={pbusy || (pname.trim() === user.name && pemail.trim() === user.email)} className="h-11 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
            {pbusy ? "Saving…" : "Save details"}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">Only an admin can change your role.</p>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="h-4 w-4 text-muted-foreground" />Change password</h2>
        <form onSubmit={save} className="mt-4 space-y-3">
          <PasswordField label="Current password" value={cur} onChange={setCur} autoComplete="current-password" show={show} setShow={setShow} />
          <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" show={show} setShow={setShow} placeholder={`At least ${MIN_PASSWORD} characters`} />
          <PasswordField label="Repeat new password" value={again} onChange={setAgain} autoComplete="new-password" show={show} setShow={setShow} />
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

function PasswordField({ label, value, onChange, autoComplete, show, setShow, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; show: boolean; setShow: (f: (s: boolean) => boolean) => void; placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="m3-label">{label}</span>
      <div className="relative">
        <input className={`${field} pr-11`} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} required />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide passwords" : "Show passwords"} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
