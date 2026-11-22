import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import {
  Clock,
  BarChart3,
  Settings,
  HardHat,
  Search,
  Lock,
  HelpCircle,
} from "lucide-react";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { CommandPalette } from "@/components/CommandPalette";
import { AuthGate } from "@/components/AuthGate";
import { NavHeaderActions } from "@/components/NavHeaderActions";
import { Badge } from "@/components/ui/badge";

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
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <KeyboardShortcutsProvider>
          <AuthGate>
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/60">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                  <Link
                    href="/"
                    className="flex items-center gap-2.5 transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/20">
                      <Clock className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex flex-col">
                      <div className="text-sm font-semibold tracking-tight text-foreground">
                        TimeTrack
                      </div>
                      <div className="text-[11px] font-medium text-muted-foreground hidden sm:block">
                        Field & Office • QuickBooks Desktop Ready
                      </div>
                    </div>
                  </Link>

                  <nav className="flex items-center gap-1 sm:gap-2">
                    <Link
                      href="/engineer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-primary hover:bg-secondary/50 transition"
                    >
                      <HardHat className="w-3.5 h-3.5" />
                      <span>Engineer</span>
                    </Link>

                    <Link
                      href="/accountant"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-primary hover:bg-secondary/50 transition"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Accountant</span>
                    </Link>

                    <Link
                      href="/settings"
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Directory</span>
                    </Link>
                  </nav>

                  <NavHeaderActions />
                </div>
              </div>
            </header>

            <main className="flex-1">{children}</main>

            <CommandPalette />
            <KeyboardShortcutsModal />

            <footer className="border-t border-border bg-background/50 py-5 text-xs text-muted-foreground text-center mt-auto">
              <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-5 w-5 px-0 text-[10px]">
                    QB
                  </Badge>
                  <span className="font-medium">
                    QuickBooks Desktop IIF (TIMEACT) & CSV Engine Active
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-secondary rounded border">
                      ⌘K
                    </kbd>{" "}
                    for commands
                  </span>
                  <span>•</span>
                  <span>
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-secondary rounded border">
                      ?
                    </kbd>{" "}
                    for shortcuts
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
