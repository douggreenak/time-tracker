import Link from "next/link";
import { HardHat, BarChart3, FileSpreadsheet, ArrowRight, CheckCircle2, Shield, Smartphone, Globe, Database } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          Engineered for Field Mobility & Office Accuracy
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
          Time Tracking with Native <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            QuickBooks Desktop Import
          </span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
          Log project hours on-site or in the office. One-click export to official QuickBooks Desktop{" "}
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-mono text-emerald-700">.iif</code> format and comprehensive audit CSVs.
        </p>
      </div>

      {/* Two Role Portals Grid */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
        {/* Engineer Portal Card */}
        <Link
          href="/engineer"
          className="group relative bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <HardHat className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition">
                Engineer View
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Field & Office
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Start live stopwatch timer, log retroactive hours, tag job locations (On-Site Client, Office, Remote, Travel), and attach field notes.
            </p>

            <ul className="mt-5 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Persistent live timer that survives phone reload</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Customer & sub-job selector with billable toggle</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>One-tap GPS coordinate timestamp on mobile</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between font-semibold text-sm text-emerald-700">
            <span>Open Engineer Tracker</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Accountant Portal Card */}
        <Link
          href="/accountant"
          className="group relative bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-indigo-700 transition">
                Accountant View
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Audits & Exports
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Review timesheet submissions, filter by customer or engineer, track billable vs non-billable ratios, and download QuickBooks Desktop files.
            </p>

            <ul className="mt-5 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Direct <strong>.IIF (TIMEACT)</strong> export for QuickBooks Desktop</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Full CSV & Excel timesheet export for reporting</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Hours by Customer and Location distribution</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between font-semibold text-sm text-indigo-700">
            <span>Open Accountant Portal</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Feature Highlights Banner */}
      <div className="max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-emerald-400" />
          Built for Today and Expandable to Native iOS
        </h3>
        <div className="grid sm:grid-cols-3 gap-6 text-xs sm:text-sm text-slate-300">
          <div>
            <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400" />
              Responsive Web First
            </div>
            Works seamlessly in Safari and Chrome on iPhone, Android, iPad, and desktop workstations.
          </div>
          <div>
            <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-teal-400" />
              Vercel + Neon Cloud
            </div>
            Zero-maintenance serverless setup with real-time PostgreSQL syncing between field and office.
          </div>
          <div>
            <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              QuickBooks Certified
            </div>
            Standardized IIF formatting matches Intuit specifications for effortless timesheet ingestion.
          </div>
        </div>
      </div>
    </div>
  );
}
