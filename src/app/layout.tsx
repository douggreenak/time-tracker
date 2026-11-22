import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Clock } from "lucide-react";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "TimeTrack",
  description: "Accurate time tracking with QuickBooks Desktop IIF export.",
};

// Runs before first paint so dark mode never flashes light.
const themeScript = `try{var t=localStorage.getItem('tt-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Display:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
          <div className="flex h-14 w-full items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/engineer" className="group flex shrink-0 items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform duration-300 ease-expressive group-hover:scale-105">
                <span className="absolute inset-0" style={{ background: "var(--fab-gradient)" }} />
                <Clock className="relative h-4 w-4 text-white" strokeWidth={2.5} />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">TimeTrack</span>
            </Link>
            <NavLinks />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
