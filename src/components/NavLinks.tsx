"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, HardHat, Settings } from "lucide-react";
import { cn } from "@/components/ui";

const NAV_ITEMS = [
  { href: "/engineer", label: "Engineer", icon: HardHat },
  { href: "/accountant", label: "Accountant", icon: BarChart3 },
  { href: "/settings", label: "Directory", icon: Settings },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 rounded-full bg-surface-container-low p-1.5">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium tracking-tight transition-all duration-200 ease-expressive sm:px-4 sm:text-sm",
              isActive
                ? "bg-card text-primary shadow-xs"
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={isActive ? 2.4 : 2} />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
