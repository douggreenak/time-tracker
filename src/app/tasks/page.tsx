"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, Search, Trash2, X } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import type { TimeEntryItem } from "@/db/mock-data";
import { TextCell, cellBase } from "@/components/ui/cell";
import { useAuth } from "@/components/AuthProvider";
import { useDirectory } from "@/lib/useDirectory";
import { cn } from "@/components/ui";

function TasksPage() {
  const dir = useDirectory();
  const { isManager: canEdit } = useAuth(); // everyone can add; changing or deleting is for accountants/admins
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [name, setName] = useState("");
  const [qb, setQb] = useState("");
  const [billable, setBillable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [bill, setBill] = useState("all");
  const [usage, setUsage] = useState("all");

  useEffect(() => {
    fetch("/api/time-entries").then((r) => r.json()).then((j) => j.success && setEntries(j.data)).catch(() => {});
  }, []);

  const minutes = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => m.set(e.serviceItemId, (m.get(e.serviceItemId) ?? 0) + e.durationMinutes));
    return m;
  }, [entries]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return dir.serviceItems.filter(
      (t) =>
        (!s || t.name.toLowerCase().includes(s) || t.qbItemName.toLowerCase().includes(s)) &&
        (bill === "all" || (bill === "billable") === t.defaultBillable) &&
        (usage === "all" || (usage === "used") === (minutes.get(t.id) ?? 0) > 0)
    );
  }, [dir.serviceItems, q, bill, usage, minutes]);

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
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Tasks</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">What the time was spent on — e.g. Field inspection, Design review. Each one maps to a QuickBooks service item, whose name must match exactly for IIF import.</p>
      </div>

      {error && (
        <div role="alert" className="flex animate-m3-rise items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div role="group" aria-label="Task filters" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or QuickBooks items…" aria-label="Search tasks" className="h-9 w-full rounded-full border border-outline-variant bg-surface-low pl-8 pr-3 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25" />
        </div>
        <div className="w-44"><Dropdown aria-label="Filter task billing" value={bill} onChange={setBill} options={[{ value: "all", label: "Billable & not" }, { value: "billable", label: "Billable by default" }, { value: "non", label: "Non-billable" }]} /></div>
        <div className="w-44"><Dropdown aria-label="Filter task usage" value={usage} onChange={setUsage} options={[{ value: "all", label: "Used & unused" }, { value: "used", label: "Has logged time" }, { value: "unused", label: "No time yet" }]} /></div>
      </div>

      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
        <div className="stack-table-wrap m3-scroll max-h-[calc(100dvh-13rem)] min-h-[8rem] overflow-auto">
          <table className="stack-table w-full min-w-[44rem] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10">
              <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                <th>Task</th>
                <th className="w-[22rem]">QuickBooks service item</th>
                <th className="w-24 text-center">Billable</th>
                <th className="w-24 text-right">Hours</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
              <tr className="bg-primary-container/40">
                <td data-label="Task" className="span-2"><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="New task name" placeholder="New task — type a name and press Enter" className={cellBase} /></td>
                <td data-label="QuickBooks service item" className="span-2"><input value={qb} onChange={(e) => setQb(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="New QuickBooks item" placeholder="Same as name" className={cn(cellBase, "font-mono text-xs")} /></td>
                <td data-label="Billable" className="text-center text-center max-md:text-left"><input type="checkbox" aria-label="New item billable" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" /></td>
                <td />
                <td className="text-center">
                  <button onClick={add} aria-label="Add task" disabled={!name.trim()} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                </td>
              </tr>
              {shown.map((s) => (
                <tr key={s.id} className="group bg-card hover:bg-surface-low">
                  <td data-label="Task" className="span-2"><TextCell aria-label="Task name" disabled={!canEdit} value={s.name} onCommit={(v) => v.trim() && run(dir.updateService(s.id, { name: v.trim() }))} /></td>
                  <td data-label="QuickBooks service item" className="span-2"><TextCell aria-label="QuickBooks item" disabled={!canEdit} value={s.qbItemName} onCommit={(v) => v.trim() && run(dir.updateService(s.id, { qbItemName: v.trim() }))} className="font-mono text-xs" /></td>
                  <td data-label="Billable" className="text-center text-center max-md:text-left"><input type="checkbox" aria-label="Billable by default" disabled={!canEdit} checked={s.defaultBillable} onChange={(e) => run(dir.updateService(s.id, { defaultBillable: e.target.checked }))} className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]" /></td>
                  <td data-label="Hours" className="px-2 text-right font-mono text-[13px] tabular-nums">{((minutes.get(s.id) ?? 0) / 60).toFixed(2)}</td>
                  <td className="text-center actions-cell">
                    {canEdit && <button
                      onClick={() => confirm(`Delete “${s.name}”? This can't be undone.`) && run(dir.deleteService(s.id))}
                      aria-label={`Delete ${s.name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    ><Trash2 className="h-3.5 w-3.5" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">Tasks with logged time can&apos;t be deleted. {canEdit ? "Edits save when you leave a cell." : "You can add tasks; accountants and admins can change or delete them."}</div>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <TasksPage />
  );
}
