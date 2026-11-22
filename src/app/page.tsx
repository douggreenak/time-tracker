import Link from "next/link";
import {
  HardHat,
  BarChart3,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Globe,
  Database,
  Clock,
  Sparkles,
  Command,
  FileText,
  Building,
} from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
      {/* Hero Header: Material Expressive Clean Typography */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-semibold mb-5">
          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
          <span>Google Material Expressive • Field & Office Edition</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Precision Time Tracking for <br className="hidden sm:inline" />
          Field & Office Engineering
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Built for on-site mobility and office audit accuracy. Generate compliant Intuit QuickBooks
          Desktop <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono font-semibold text-slate-800 border">.IIF (TIMEACT)</code> files
          and detailed financial calculation reports.
        </p>

        {/* Global Keyboard Shortcut Pill */}
        <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-slate-200/80 shadow-2xs text-xs text-slate-600">
          <span className="font-medium">Power User Shortcuts:</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-slate-100 rounded border font-semibold">⌘K</kbd> Command Palette
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-slate-100 rounded border font-semibold">?</kbd> Shortcut Sheet
          </span>
        </div>
      </div>

      {/* Two Primary Portal Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-14">
        {/* Engineer Portal Card */}
        <Link
          href="/engineer"
          className="group bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <HardHat className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition">
                Engineer View
              </h2>
              <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-600 rounded-lg border">
                1
              </kbd>
            </div>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Start persistent digital stopwatches, capture one-tap GPS site stamps, and log retroactive hours by customer and job.
            </p>

            <ul className="mt-6 space-y-2.5 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Spacebar shortcut to start/pause live stopwatch</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Categorize by On-Site Client, Office, Remote, or Travel</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>HTML5 browser geolocation acquisition for job sites</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between font-semibold text-xs sm:text-sm text-emerald-700">
            <span>Open Engineer Tracker</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Accountant Portal Card */}
        <Link
          href="/accountant"
          className="group bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-indigo-700 transition">
                Accountant View
              </h2>
              <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-600 rounded-lg border">
                2
              </kbd>
            </div>

            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Select calculation time periods (Today, This Week, Month, Q4, Custom), review billable realization rates, and export to QuickBooks Desktop.
            </p>

            <ul className="mt-6 space-y-2.5 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Time Period selector with dynamic revenue & cost calculations</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Official QuickBooks Desktop .IIF (TIMEACT) direct download</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Grouped summary views by Client or Engineer utilization</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between font-semibold text-xs sm:text-sm text-indigo-700">
            <span>Open Accountant Portal</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Feature Highlights: Clean Material Expressive Tonal Cards */}
      <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Intuit IIF Standard</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Exports compliant tab-delimited TIMEACT headers recognized directly by QuickBooks Desktop Pro, Premier, and Enterprise.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Protected & Audited</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Secured gateway with PIN/Password authentication, multi-engineer rates, and batch approval tracking.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">High-Performance & Cloud Ready</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Sub-millisecond Next.js serverless execution, responsive across mobile phones and desktop displays.
          </p>
        </div>
      </div>
    </div>
  );
}
