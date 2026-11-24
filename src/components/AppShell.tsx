"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";
import { Loader } from "./ui/loader";
import { AuthProvider, useAuth } from "./AuthProvider";
import { LoginScreen } from "./LoginScreen";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { SaveIndicator } from "./SaveIndicator";
import { SelectOnFocus } from "./SelectOnFocus";
import { DemoBanner } from "./DemoBanner";
import { UserMenu } from "./UserMenu";

function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, isManager, isAdmin } = useAuth();
  const pathname = usePathname();

  // One wrapper that never changes between loading / signed-out / signed-in, so the menu bar is always
  // the first row of it no matter how the page above was built or what the browser inserts into <body>.
  const frame = "grid h-dvh w-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)] print:block print:h-auto";
  if (loading)
    return (
      <div className={frame}>
        <div className="row-span-2 flex items-center justify-center">
          <Loader size={56} label="Loading TimeTrack…" />
        </div>
      </div>
    );
  if (!user) return <div className={frame}><div className="row-span-2 min-h-0 overflow-y-auto"><LoginScreen /></div></div>;

  return (
    <div className={frame}>
      <header className="z-40 row-start-1 shrink-0 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 w-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          <Link href="/engineer" className="group flex shrink-0 items-center gap-2.5" aria-label="TimeTrack home">
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform duration-300 ease-expressive group-hover:scale-105">
              <span className="absolute inset-0" style={{ background: "var(--fab-gradient)" }} />
              <Clock className="relative h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
            <span className="hidden text-[15px] font-semibold tracking-tight lg:block">TimeTrack</span>
          </Link>
          <NavLinks />
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <SaveIndicator />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <SelectOnFocus />
      {/* The header above is a normal first row; only this area scrolls, so the account/menu bar always stays on top. */}
      <div className="row-start-2 min-h-0 overflow-y-auto print:overflow-visible">
        {isManager && <DemoBanner canClear={isAdmin} />}
        <main key={pathname} className="flex min-h-full animate-m3-fade flex-col">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
