"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";
import { hourDifference } from "@/lib/hours";
import { cn } from "@/components/ui";

const input = "h-9 w-full rounded-lg border border-outline-variant bg-surface-low px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

/** The workbook's HOUR DIFFERENCES sheet: start and end in military time, minus gaps, plus a block. */
export function HoursCalculator({ onUse }: { onUse: (hours: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ start: "", end: "", minus: "", plus: "" });
  const result = v.start && v.end ? hourDifference(v.start, v.end, v.minus, v.plus) : null;
  const field = (key: keyof typeof v, label: string, placeholder: string) => (
    <label className="block text-[11px] font-semibold text-muted-foreground">
      {label}
      <input aria-label={label} inputMode="text" placeholder={placeholder} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} className={cn(input, "mt-1 font-mono")} />
    </label>
  );
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="hours-calc-toggle"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <Calculator className="h-3.5 w-3.5" />Hours calculator
      </button>
      {open && (
        <div role="dialog" aria-label="Hours calculator" className="absolute right-0 top-11 z-50 w-72 animate-m3-rise rounded-2xl border border-border bg-card p-4 shadow-2xl max-sm:right-auto max-sm:left-0">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Hours calculator</h3>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("start", "Start", "0730")}
            {field("end", "End", "1650")}
            {field("minus", "Minus (lunch…)", "30m")}
            {field("plus", "Plus (extra)", "1h")}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Times are military (1304 = 1:04 pm). Rounds to a tenth of an hour.</p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-low px-3 py-2">
            <span data-testid="hours-calc-result" className="font-mono text-xl font-semibold tabular-nums">{result === null ? "—" : result.toFixed(1)} <span className="text-xs font-medium text-muted-foreground">h</span></span>
            <button
              type="button"
              disabled={result === null}
              onClick={() => { onUse(String(result)); setOpen(false); }}
              data-testid="hours-calc-use"
              className="h-8 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
            >Use</button>
          </div>
        </div>
      )}
    </div>
  );
}
