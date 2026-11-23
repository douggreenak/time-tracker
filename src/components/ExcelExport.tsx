"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { weekRangeLabel, weekStart } from "@/lib/weeks";
import { cn } from "@/components/ui";

const sel =
  "h-9 rounded-full border border-outline-variant bg-surface-low px-3 text-xs font-medium outline-none transition-colors hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25";

/**
 * Weekly Excel timesheet (the company's Time Sheet template). The week must be picked first — there is no default.
 * `weeks` are week-start dates (Sundays) to offer; the current week is always included.
 */
export function ExcelExport({
  userId,
  weeks,
  people,
  onPerson,
  className,
}: {
  userId: string;
  weeks: string[];
  /** When given, shows a person picker (managers). */
  people?: { id: string; name: string }[];
  onPerson?: (id: string) => void;
  className?: string;
}) {
  const [week, setWeek] = useState("");
  const options = useMemo(() => {
    const set = new Set(weeks);
    set.add(weekStart(new Date().toLocaleDateString("en-CA")));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [weeks]);
  const ready = !!week && !!userId;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Excel timesheet">
      {people && (
        <select aria-label="Excel timesheet person" value={userId} onChange={(e) => onPerson?.(e.target.value)} className={sel}>
          {userId === "" && <option value="">Pick a person…</option>}
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
      <select aria-label="Excel timesheet week" value={week} onChange={(e) => setWeek(e.target.value)} className={sel}>
        <option value="">Pick a week…</option>
        {options.map((w) => (
          <option key={w} value={w}>{weekRangeLabel(w)}</option>
        ))}
      </select>
      <a
        href={ready ? `/api/export/excel?userId=${encodeURIComponent(userId)}&week=${week}` : undefined}
        download
        aria-disabled={!ready}
        aria-label="Download Excel timesheet"
        title={ready ? "Download that week as the Excel timesheet" : "Pick a week first"}
        onClick={(e) => !ready && e.preventDefault()}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold transition",
          ready ? "text-foreground hover:bg-foreground/[0.05]" : "cursor-not-allowed text-muted-foreground/60"
        )}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />Excel timesheet
      </a>
    </div>
  );
}
