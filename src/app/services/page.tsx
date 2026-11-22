"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, Trash2, X } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { TextCell, cellBase } from "@/components/ui/cell";
import { useDirectory } from "@/lib/useDirectory";
import { cn } from "@/components/ui";

export default function ServicesPage() {
  const dir = useDirectory();
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [name, setName] = useState("");
  const [qb, setQb] = useState("");
  const [billable, setBillable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/time-entries").then((r) => r.json()).then((j) => j.success && setEntries(j.data)).catch(() => {});
  }, []);

  const minutes = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => m.set(e.serviceItemId, (m.get(e.serviceItemId) ?? 0) + e.durationMinutes));
    return m;
  }, [entries]);

  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    setError(r.ok ? null : r.error ?? "Failed");
    return r;
  };

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    if (dir.serviceItems.some((s) => s.name.toLowerCase() === n.toLowerCase())) return setError(`“${n}” already exists.`);
    const r = await run(dir.createService(n, billable, qb.trim() || undefined));
    if (r.ok) {
      setName("");
      setQb("");
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Service items</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">What the time was spent on. The QuickBooks name must match your item list exactly for IIF import.</p>
      </div>

      {error && (
        <div role="alert" className="flex animate-m3-rise items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="m3-scroll h-[calc(100dvh-13rem)] min-h-[16rem] overflow-auto">
          <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10">
              <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                <th>Name</th>
                <th className="w-[22rem]">QuickBooks item</th>
                <th className="w-24 text-center">Billable</th>
                <th className="w-24 text-right">Hours</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
              <tr className="bg-primary-container/40">
                <td><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="New service name" placeholder="New service item — type a name and press Enter" className={cellBase} /></td>
                <td><input value={qb} onChange={(e) => setQb(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="New QuickBooks item" placeholder="Same as name" className={cn(cellBase, "font-mono text-xs")} /></td>
                <td className="text-center"><input type="checkbox" aria-label="New item billable" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" /></td>
                <td />
                <td className="text-center">
                  <button onClick={add} aria-label="Add service item" disabled={!name.trim()} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                </td>
              </tr>
              {dir.serviceItems.map((s) => (
                <tr key={s.id} className="group bg-card hover:bg-surface-low">
                  <td><TextCell aria-label="Service name" value={s.name} onCommit={(v) => v.trim() && run(dir.updateService(s.id, { name: v.trim() }))} /></td>
                  <td><TextCell aria-label="QuickBooks item" value={s.qbItemName} onCommit={(v) => v.trim() && run(dir.updateService(s.id, { qbItemName: v.trim() }))} className="font-mono text-xs" /></td>
                  <td className="text-center"><input type="checkbox" aria-label="Billable by default" checked={s.defaultBillable} onChange={(e) => run(dir.updateService(s.id, { defaultBillable: e.target.checked }))} className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]" /></td>
                  <td className="px-2 text-right font-mono text-[13px] tabular-nums">{((minutes.get(s.id) ?? 0) / 60).toFixed(2)}</td>
                  <td className="text-center">
                    <button
                      onClick={() => confirm(`Delete “${s.name}”? This can't be undone.`) && run(dir.deleteService(s.id))}
                      aria-label={`Delete ${s.name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">Items with logged time can&apos;t be deleted. Edits save when you leave a cell.</div>
      </section>
    </div>
  );
}
