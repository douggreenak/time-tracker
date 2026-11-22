import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Clock, BarChart3, Settings, ShieldCheck, HardHat, FileSpreadsheet } from "lucide-react";

export const metadata: Metadata = {
  title: "Field & Office Time Tracker | QuickBooks Ready",
  description: "Time tracking for engineers working on-site and in-office with seamless QuickBooks Desktop IIF & CSV export.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo / Title */}
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 hover:opacity-90 transition">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
                    <Clock className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="text-base tracking-tight font-extrabold flex items-center gap-1.5">
                      TimeTrack <span className="text-emerald-600 font-semibold text-xs px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200/60 uppercase">Field + Office</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">QuickBooks Desktop Integrated</div>
                  </div>
                </Link>
              </div>

              {/* Navigation Links */}
              <nav className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href="/engineer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200/50 transition"
                >
                  <HardHat className="w-4 h-4 text-emerald-600" />
                  <span>Engineer View</span>
                </Link>

                <Link
                  href="/accountant"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/70 border border-transparent hover:border-indigo-200/50 transition"
                >
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>Accountant View</span>
                </Link>

                <Link
                  href="/settings"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Directory</span>
                </Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-16">{children}</main>

        <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 text-center">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>QuickBooks Desktop IIF (TIMEACT) & CSV Ready</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Hosted on Vercel • Neon DB Compatible</span>
              <span className="text-slate-300">|</span>
              <span>iOS Swift API Ready</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
