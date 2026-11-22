import Link from "next/link";
import {
  HardHat,
  BarChart3,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const HIGHLIGHTS = [
  {
    icon: FileSpreadsheet,
    title: "Intuit IIF standard",
    body: "Tab-delimited TIMEACT headers recognised directly by QuickBooks Desktop Pro, Premier, and Enterprise.",
  },
  {
    icon: ShieldCheck,
    title: "Audited by design",
    body: "PIN-gated access, per-engineer billing rates, and a batch approval trail for every timesheet record.",
  },
  {
    icon: Globe,
    title: "Cloud ready",
    body: "Serverless Next.js routes with a decoupled REST API, ready to back a native iOS client.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:px-8">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <Badge variant="outline" className="mb-6">
          Field &amp; Office edition
        </Badge>

        <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[4rem]">
          Precision time tracking for{" "}
          <span className="text-primary">field &amp; office</span> engineering
        </h1>

        <p className="mx-auto mb-9 mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Built for on-site mobility and office audit accuracy. Generate compliant
          QuickBooks Desktop{" "}
          <span className="rounded-md bg-surface-container px-2 py-0.5 font-mono text-sm font-medium text-foreground">
            .IIF (TIMEACT)
          </span>{" "}
          files and financial calculation reports in one pass.
        </p>

        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-surface-low p-1.5">
          <span className="px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Shortcuts
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs">
            <kbd className="font-mono text-[11px] font-semibold">⌘K</kbd>
            commands
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs">
            <kbd className="font-mono text-[11px] font-semibold">?</kbd>
            shortcuts
          </span>
        </div>
      </div>

      <div className="mx-auto mb-14 grid max-w-5xl gap-6 md:grid-cols-2">
        <Link href="/engineer" className="group">
          <Card className="h-full border-border/60 transition-all duration-300 ease-expressive group-hover:-translate-y-0.5 group-hover:shadow-m3-2">
            <CardHeader className="pb-4">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 ease-expressive group-hover:scale-105">
                <HardHat className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Engineer view</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Start a persistent stopwatch, stamp GPS site coordinates, and log
                retroactive hours by customer and job.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Spacebar starts, pauses, and resumes the stopwatch",
                  "Categorise work as on-site, office, remote, or travel",
                  "One-tap browser geolocation for job sites",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-5">
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium text-primary">
                  Open engineer tracker
                </span>
                <ArrowRight className="h-4 w-4 text-primary transition-transform duration-300 ease-expressive group-hover:translate-x-1" />
              </div>
            </CardFooter>
          </Card>
        </Link>

        <Link href="/accountant" className="group">
          <Card className="h-full border-border/60 transition-all duration-300 ease-expressive group-hover:-translate-y-0.5 group-hover:shadow-m3-2">
            <CardHeader className="pb-4">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary-container/60 text-tertiary-on-container transition-transform duration-300 ease-expressive group-hover:scale-105">
                <BarChart3 className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Accountant view</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Select calculation periods, review billable realisation, and export
                straight to QuickBooks Desktop.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Period presets with live revenue and cost totals",
                  "QuickBooks Desktop .IIF (TIMEACT) download",
                  "Summary views by client or engineer utilisation",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="border-t border-border/50 pt-5">
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium text-primary">
                  Open accountant portal
                </span>
                <ArrowRight className="h-4 w-4 text-primary transition-transform duration-300 ease-expressive group-hover:translate-x-1" />
              </div>
            </CardFooter>
          </Card>
        </Link>
      </div>

      <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
        {HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="border-0 bg-surface-low shadow-none">
              <CardHeader className="pb-2">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-xs">
                  <Icon className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
