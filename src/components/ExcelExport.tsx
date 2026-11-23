"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { weekRangeLabel, weekStart } from "@/lib/weeks";
import { cn } from "@/components/ui";
import { Dropdown } from "@/components/ui/dropdown";

const NEEDS_WEEK = "Pick a week first — the Excel timesheet is generated for one week at a time.";

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
        <div className="w-44">
          <Dropdown
            aria-label="Excel timesheet person"
            value={userId}
            onChange={(v) => onPerson?.(v)}
            placeholder="Pick a person…"
            options={people.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      )}
      <div className="w-44">
        <Dropdown
          aria-label="Excel timesheet week"
          value={week}
          onChange={setWeek}
          placeholder="Pick a week…"
          title={NEEDS_WEEK}
          options={options.map((w) => ({ value: w, label: weekRangeLabel(w) }))}
        />
      </div>
      <a
        href={ready ? `/api/export/excel?userId=${encodeURIComponent(userId)}&week=${week}` : undefined}
        download
        aria-disabled={!ready}
        aria-label="Download Excel timesheet"
        title={ready ? "Download that week as the Excel timesheet" : NEEDS_WEEK}
        onClick={(e) => !ready && e.preventDefault()}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold transition",
          ready ? "text-foreground hover:bg-foreground/[0.05]" : "cursor-not-allowed text-muted-foreground/60"
        )}
      >
        <Download className="h-3.5 w-3.5" />Excel timesheet
      </a>
    </div>
  );
}
