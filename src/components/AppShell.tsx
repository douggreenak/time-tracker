"use client";

import Link from "next/link";
import { Clock, Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { LoginScreen } from "./LoginScreen";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { SaveIndicator } from "./SaveIndicator";
import { SelectOnFocus } from "./SelectOnFocus";
import { DemoBanner } from "./DemoBanner";
import { UserMenu } from "./UserMenu";

function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, isManager } = useAuth();

  if (loading)
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  if (!user) return <div className="h-dvh overflow-y-auto"><LoginScreen /></div>;

  return (
    <>
      <header className="z-40 shrink-0 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 w-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          <Link href="/engineer" className="group flex shrink-0 items-center gap-2.5" aria-label="TimeTrack home">
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform duration-300 ease-expressive group-hover:scale-105">
              <span className="absolute inset-0" style={{ background: "var(--fab-gradient)" }} />
              <Clock className="relative h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight lg:block">TimeTrack</span>
          </Link>
          <NavLinks isManager={isManager} />
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <SaveIndicator />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <SelectOnFocus />
      {/* The header above is a normal first row; only this area scrolls, so the account/menu bar always stays on top. */}
      <div className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
        {isManager && <DemoBanner />}
        <main className="flex min-h-full flex-col">{children}</main>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
