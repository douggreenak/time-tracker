"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, Clock, ListChecks, Users } from "lucide-react";
import { cn } from "@/components/ui";

const NAV_ITEMS = [
  { href: "/engineer", label: "Timesheet", icon: Clock, manager: false },
  { href: "/accountant", label: "Review & export", icon: BarChart3, manager: true },
  { href: "/customers", label: "Customers", icon: Building2, manager: true },
  { href: "/tasks", label: "Tasks", icon: ListChecks, manager: true },
  { href: "/team", label: "Team", icon: Users, manager: true, admin: true },
];

export function NavLinks({ isManager, isAdmin = false }: { isManager: boolean; isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => (isManager || !i.manager) && (isAdmin || !i.admin));
  return (
    <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5 rounded-full bg-surface-container p-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={label}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ease-expressive sm:px-3.5",
              active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={active ? 2.5 : 2} />
            <span className={cn(active ? "inline" : "hidden", "max-sm:hidden xl:inline")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
