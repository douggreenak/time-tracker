"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, Clock, Layers } from "lucide-react";
import { cn } from "@/components/ui";

const NAV_ITEMS = [
  { href: "/engineer", label: "Timesheet", icon: Clock },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/services", label: "Services", icon: Layers },
  { href: "/accountant", label: "Review & export", icon: BarChart3 },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 rounded-full bg-surface-container p-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-expressive sm:px-4",
              active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.5 : 2} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
