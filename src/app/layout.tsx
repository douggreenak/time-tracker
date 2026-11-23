import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "TimeTrack",
  description: "Accurate time tracking with QuickBooks Desktop IIF export.",
  applicationName: "TimeTrack",
  appleWebApp: { capable: true, title: "TimeTrack", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b6a8c",
  width: "device-width",
  initialScale: 1,
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
      <body className="h-dvh overflow-hidden bg-background text-foreground print:block print:h-auto print:overflow-visible">
        <AppShell>{children}</AppShell>
        <PwaRegister />
      </body>
    </html>
  );
}
