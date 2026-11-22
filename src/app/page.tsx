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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <Badge variant="outline" className="text-xs font-medium mb-5 inline-block">
          Field &amp; Office Edition
        </Badge>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-foreground tracking-tight leading-tight mb-6 text-balance">
          Precision Time Tracking for<br />
          Field &amp; Office Engineering
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
          Built for on-site mobility and office audit accuracy. Generate compliant Intuit
          QuickBooks Desktop <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded font-semibold">.IIF (TIMEACT)</span>
          files and detailed financial calculation reports.
        </p>

        <div className="flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-secondary border border-border/60 text-xs text-muted-foreground inline-block">
          <span className="font-medium">Power User Shortcuts:</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-foreground text-primary-foreground rounded border">⌘K</kbd>
            Command Palette
          </span>
          <span className="px-1 text-muted-foreground">•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-foreground text-primary-foreground rounded border">?</kbd>
            Shortcut Sheet
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-14">
        <Link
          href="/engineer"
          className="group relative overflow-hidden"
        >
          <Card className="hover:shadow-xl transition-all duration-300 group-hover:border-primary/50 border border-border/60">
            <CardHeader className="pb-4">
              <div className="w-10 h-10 rounded-lg bg-secondary text-primary flex items-center justify-center mb-4">
                <HardHat className="w-5 h-5" />
              </div>
              <CardTitle className="text-xl">Engineer View</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Start persistent digital stopwatches, capture GPS site stamps, and log
                retroactive hours by customer and job.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>Spacebar to start/pause live stopwatch</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>Categorize by On-Site Client, Office, Remote, or Travel</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>HTML5 browser geolocation acquisition for job sites</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="pt-0 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">Open Engineer Tracker</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardFooter>
          </Card>
        </Link>

        <Link
          href="/accountant"
          className="group relative overflow-hidden"
        >
          <Card className="hover:shadow-xl transition-all duration-300 group-hover:border-primary/50 border border-border/60">
            <CardHeader className="pb-4">
              <div className="w-10 h-10 rounded-lg bg-secondary text-primary flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <CardTitle className="text-xl">Accountant View</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Select calculation time periods, review billable realization rates, and export
                to QuickBooks Desktop.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>Time Period selector with dynamic revenue &amp; cost calculations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>QuickBooks Desktop .IIF (TIMEACT) direct download</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>Grouped summary views by Client or Engineer utilization</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter className="pt-0 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">Open Accountant Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardFooter>
          </Card>
        </Link>
      </div>

      <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="w-9 h-9 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm">Intuit IIF Standard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Exports compliant tab-delimited TIMEACT headers recognized directly by QuickBooks
              Desktop Pro, Premier, and Enterprise.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="w-9 h-9 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm">Protected &amp; Audited</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Secured gateway with PIN/Password authentication, multi-engineer rates, and batch
              approval tracking.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="w-9 h-9 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center mb-3">
              <Globe className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm">High-Performance &amp; Cloud Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sub-millisecond Next.js serverless execution, responsive across mobile phones and
              desktop displays.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
