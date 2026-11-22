import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Clock } from "lucide-react";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { CommandPalette } from "@/components/CommandPalette";
import { AuthGate } from "@/components/AuthGate";
import { NavHeaderActions } from "@/components/NavHeaderActions";
import { NavLinks } from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "Field & Office Time Tracker | QuickBooks Ready",
  description:
    "Professional engineering time tracking with accountant auditing and QuickBooks Desktop export.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <KeyboardShortcutsProvider>
          <AuthGate>
            <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
              <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                <Link href="/" className="group flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-m3-1 transition-transform duration-300 ease-expressive group-hover:scale-105">
                    <Clock className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                      TimeTrack
                    </span>
                    <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
                      Field &amp; Office · QuickBooks ready
                    </span>
                  </div>
                </Link>

                <NavLinks />

                <NavHeaderActions />
              </div>
            </header>

            <main className="flex-1">{children}</main>

            <CommandPalette />
            <KeyboardShortcutsModal />

            <footer className="mt-auto border-t border-border/60 bg-surface-low/70 py-6 text-xs text-muted-foreground">
              <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    QB
                  </span>
                  <span className="font-medium">
                    QuickBooks Desktop IIF (TIMEACT) &amp; CSV engine active
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1">
                    <kbd className="font-mono text-[10px] font-semibold text-foreground">
                      ⌘K
                    </kbd>
                    commands
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1">
                    <kbd className="font-mono text-[10px] font-semibold text-foreground">
                      ?
                    </kbd>
                    shortcuts
                  </span>
                </div>
              </div>
            </footer>
          </AuthGate>
        </KeyboardShortcutsProvider>
      </body>
    </html>
  );
}
