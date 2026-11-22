import Link from "next/link";
import { Clock, BarChart3, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="mb-16 text-center">
        <h1 className="mb-3 text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Time Tracker
        </h1>
        <p className="text-base text-muted-foreground">
          Log hours. Export to QuickBooks. That&apos;s it.
        </p>
      </div>

      {/* Two big cards */}
      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <Link
          href="/engineer"
          className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40"
        >
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
            <Clock className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="mb-1 text-xl font-bold text-foreground">Track Time</h2>
            <p className="text-sm text-muted-foreground">Stopwatch or manual entry</p>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-border/50 pt-5">
            <span className="text-sm font-semibold text-primary">Open</span>
            <ArrowRight className="h-4 w-4 text-primary transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </Link>

        <Link
          href="/accountant"
          className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-tertiary/40"
        >
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-tertiary/10 text-tertiary transition-transform duration-300 group-hover:scale-105">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="mb-1 text-xl font-bold text-foreground">Review &amp; Export</h2>
            <p className="text-sm text-muted-foreground">Approve hours, download IIF</p>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-border/50 pt-5">
            <span className="text-sm font-semibold text-tertiary">Open</span>
            <ArrowRight className="h-4 w-4 text-tertiary transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </Link>
      </div>
    </div>
  );
}
