"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { useAuth } from "./AuthProvider";

const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
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
        <div role="menu" className="absolute right-0 top-11 z-50 w-72 max-w-[calc(100vw-1.5rem)] origin-top-right animate-m3-pop rounded-2xl border border-border bg-card p-2 shadow-xl">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="text-[13px] capitalize text-foreground/70">{user.role}</div>
            <div className="break-all text-[13px] text-foreground/70" data-testid="menu-email">{user.email}</div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} data-testid="account-link" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-foreground/[0.06]">
            <KeyRound className="h-4 w-4 text-muted-foreground" />Account &amp; password
          </Link>
          <button role="menuitem" onClick={signOut} data-testid="sign-out" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4" />Sign out
          </button>
        </div>
      )}
    </div>
  );
}
