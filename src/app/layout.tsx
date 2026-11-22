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
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { CommandPalette } from "@/components/CommandPalette";
import { AuthGate } from "@/components/AuthGate";
import { NavHeaderActions } from "@/components/NavHeaderActions";

export const metadata: Metadata = {
  title: "Field & Office Time Tracker | QuickBooks Ready",
  description:
    "High-performance engineering time tracking with Google Material Expressive UX, accountant auditing, and seamless QuickBooks Desktop export.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#f8fafd] text-[#1f2937] antialiased selection:bg-indigo-100 selection:text-indigo-900">
        <KeyboardShortcutsProvider>
          <AuthGate>
            {/* Header: Google Material Expressive Surface */}
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  {/* Brand Logo & Title */}
                  <div className="flex items-center gap-3">
                    <Link
                      href="/"
                      className="group flex items-center gap-2.5 transition"
                    >
                      <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/25 group-hover:scale-105 transition-transform">
                        <Clock className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                          TimeTrack
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                            Expressive
                          </span>
                        </div>
                        <div className="text-[11px] font-medium text-slate-400 hidden sm:block">
                          Field & Office • QuickBooks Desktop Ready
                        </div>
                      </div>
                    </Link>
                  </div>

                  {/* Navigation Pills (Material Expressive Segmented Tabs) */}
                  <nav className="flex items-center gap-1 sm:gap-2">
                    <Link
                      href="/engineer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/80 border border-transparent hover:border-emerald-200/60 transition group"
                    >
                      <HardHat className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Engineer</span>
                      <kbd className="hidden md:inline-block px-1 py-0.2 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
                        1
                      </kbd>
                    </Link>

                    <Link
                      href="/accountant"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/80 border border-transparent hover:border-indigo-200/60 transition group"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Accountant</span>
                      <kbd className="hidden md:inline-block px-1 py-0.2 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
                        2
                      </kbd>
                    </Link>

                    <Link
                      href="/settings"
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      <span>Directory</span>
                      <kbd className="hidden md:inline-block px-1 py-0.2 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
                        3
                      </kbd>
                    </Link>
                  </nav>

                  {/* Right Header Actions (Command Palette Trigger, Shortcuts, Lock) */}
                  <NavHeaderActions />
                </div>
              </div>
            </header>

            {/* Main Application Canvas */}
            <main className="flex-1 pb-16">{children}</main>

            {/* Modals & Command Palettes */}
            <CommandPalette />
            <KeyboardShortcutsModal />

            {/* Footer */}
            <footer className="border-t border-slate-200/80 bg-white py-5 text-xs text-slate-500 text-center">
              <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-medium text-slate-600">
                    QuickBooks Desktop IIF (TIMEACT) & CSV Engine Active
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <span>Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded">⌘K</kbd> for commands</span>
                  <span>•</span>
                  <span>Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded">?</kbd> for shortcuts</span>
                </div>
              </div>
            </footer>
          </AuthGate>
        </KeyboardShortcutsProvider>
      </body>
    </html>
  );
}
