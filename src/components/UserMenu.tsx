"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, X } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";

const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const input =
  "h-10 w-full rounded-lg border border-outline-variant bg-surface-low px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!user) return null;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const j = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    }).then((r) => r.json());
    setMsg({ ok: !!j.success, text: j.success ? "Password changed." : j.error });
    if (j.success) {
      setCur("");
      setNext("");
      setTimeout(() => setChanging(false), 1200);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        data-testid="user-menu"
        className="flex h-9 items-center gap-2 rounded-full pl-1 pr-1 text-left transition-colors hover:bg-foreground/[0.06] sm:pr-3"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{initials(user.name)}</span>
        <span className="hidden max-w-[9rem] truncate text-xs font-semibold sm:block">{user.name}</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-72 max-w-[calc(100vw-1.5rem)] animate-m3-in rounded-2xl border border-border bg-card p-2 shadow-xl">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs capitalize text-muted-foreground">{user.role} · {user.email}</div>
          </div>
          <div className="my-1 h-px bg-border" />
          {changing ? (
            <form onSubmit={changePassword} className="space-y-2 p-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                Change password
                <button type="button" onClick={() => { setChanging(false); setMsg(null); }} aria-label="Cancel" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-3.5 w-3.5" /></button>
              </div>
              <input aria-label="Current password" type="password" placeholder="Current password" className={input} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
              <input aria-label="New password" type="password" placeholder="New password (8+ characters)" className={input} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
              {msg && <p className={cn("text-xs font-medium", msg.ok ? "text-tertiary" : "text-destructive")}>{msg.text}</p>}
              <button type="submit" className="h-9 w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground hover:brightness-110">Save password</button>
            </form>
          ) : (
            <>
              <button role="menuitem" onClick={() => setChanging(true)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-foreground/[0.06]">
                <KeyRound className="h-4 w-4 text-muted-foreground" />Change password
              </button>
              <button role="menuitem" onClick={signOut} data-testid="sign-out" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4" />Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
