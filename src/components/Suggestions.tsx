"use client";

import { useState } from "react";
import { Check, MapPin, Sparkles, X } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { useAuth } from "@/components/AuthProvider";
import { useDirectory } from "@/lib/useDirectory";
import { api, dayText, hm, timeText, type SuggestionJson } from "@/lib/useLocations";

const primary = "inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40";
const ghost = "inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold transition hover:bg-foreground/[0.05] disabled:opacity-40";

/** Billed in tenths of an hour (6 minutes). */
const tenths = (m: number) => Math.max(6, Math.round(m / 6) * 6);

/** Proposed time entries from where you spent time. Nothing is logged until you press Add. */
export function Suggestions({ items, tz, onChanged }: { items: SuggestionJson[]; tz: string; onChanged: () => void }) {
  const { user } = useAuth();
  const { customers } = useDirectory();
  const [customer, setCustomer] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const add = async (s: SuggestionJson) => {
    if (!user) return;
    setBusy(s.id); setError("");
    const label = s.name ?? "a location";
    const r = await api("/api/time-entries", "POST", {
      userId: user.id, customerId: customer[s.id] || "", date: s.date, durationMinutes: tenths(s.minutes),
      notes: `At ${label} (${timeText(s.start, tz)} – ${timeText(s.end, tz)})`,
    });
    setBusy("");
    if (r.ok) onChanged(); else setError(r.error);
  };
  const dismiss = async (s: SuggestionJson) => {
    setBusy(s.id);
    await api("/api/locations/dismiss", "POST", { stayId: s.id });
    setBusy(""); onChanged();
  };

  if (!items.length)
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-surface-low px-6 py-10 text-center">
        <Sparkles className="h-7 w-7 text-primary" strokeWidth={1.5} />
        <p className="text-sm font-semibold">Nothing to propose right now</p>
        <p className="max-w-md text-xs text-muted-foreground">Places where you spend 20 minutes or more, away from home and not already covered by time you entered, show up here as proposed entries.</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-3" data-testid="suggestions">
      {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">{error}</p>}
      {items.map((s) => (
        <div key={s.id} className="rounded-2xl border border-border/70 bg-surface-low p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.name ?? `Place near ${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}`}</p>
              <p className="text-xs text-muted-foreground">{dayText(s.date)} · {timeText(s.start, tz)} – {timeText(s.end, tz)}{s.subtitle ? ` · ${s.subtitle}` : ""}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-primary">{hm(tenths(s.minutes))}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Dropdown aria-label="Customer" value={customer[s.id] ?? ""} placeholder="Customer (optional)"
              options={[{ value: "", label: "No customer" }, ...customers.filter((c) => c.isActive !== false).map((c) => ({ value: c.id, label: c.name }))]}
              onChange={(v) => setCustomer((m) => ({ ...m, [s.id]: v }))} />
            <button className={primary} disabled={busy === s.id} onClick={() => add(s)}><Check className="h-3.5 w-3.5" />Add to timesheet</button>
            <button className={ghost} disabled={busy === s.id} onClick={() => dismiss(s)}><X className="h-3.5 w-3.5" />Not work</button>
          </div>
        </div>
      ))}
    </div>
  );
}
