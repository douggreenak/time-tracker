"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Hourglass, Layers, ReceiptText } from "lucide-react";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/lump-sum", label: "Lump sum", icon: Layers },
  { href: "/other", label: "Other", icon: ReceiptText },
  { href: "/held", label: "Held time", icon: Hourglass },
];

export function DataTabs() {
  const pathname = usePathname();
  return (
    <div className="px-4 pt-4 sm:px-6">
      <nav aria-label="Data" className="inline-flex gap-0.5 rounded-full bg-surface-container p-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ease-expressive",
                active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
