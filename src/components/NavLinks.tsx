"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Clock, Database, FileSpreadsheet, HardDriveDownload, Users } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { cn } from "@/components/ui";

// Everyone sees every tab; what they can change on each depends on their role.
const NAV_ITEMS = [
  { href: "/engineer", label: "Timesheet", icon: Clock },
  { href: "/billing", label: "Billing", icon: BarChart3 },
  { href: "/customers", label: "Customers", icon: Database },
  { href: "/files", label: "Import & saves", icon: FileSpreadsheet },
  { href: "/team", label: "Team", icon: Users },
  { href: "/admin", label: "Backup", icon: HardDriveDownload, admin: true },
];

export function NavLinks() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  return (
    <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5 rounded-full bg-surface-container p-1">
      {NAV_ITEMS.filter((i) => !("admin" in i && i.admin) || isAdmin).map((item) => {
        const { href, label, icon: Icon } = item;
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
