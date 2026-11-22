import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

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
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
