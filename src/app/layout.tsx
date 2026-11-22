import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Clock, BarChart3, Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "TimeTrack",
  description: "Accurate time tracking with QuickBooks Desktop IIF export.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Display:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            {/* Brand */}
            <Link href="/" className="group flex items-center gap-3 shrink-0">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{ background: "var(--fab-gradient)" }}
                />
                <Clock className="relative h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-base font-semibold tracking-tight text-foreground">
                TimeTrack
              </span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              <NavPill href="/engineer" icon={Clock} label="Track" />
              <NavPill href="/accountant" icon={BarChart3} label="Timesheets" />
              <NavPill href="/settings" icon={Settings} label="Directory" />
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="mt-auto border-t border-border/60 bg-surface-low/60 py-4 text-xs text-muted-foreground">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <span className="font-medium">TimeTrack</span>
            <span>QuickBooks Desktop IIF &amp; CSV</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

function NavPill({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  );
}
