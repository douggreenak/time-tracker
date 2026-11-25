"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Archive, ArchiveRestore, Plus, Search, Trash2, X } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { TextCell, cellBase } from "@/components/ui/cell";
import { useAuth } from "@/components/AuthProvider";
import { PageLoader } from "@/components/ui/loader";
import { useDirectory } from "@/lib/useDirectory";
import { fmtHours } from "@/lib/hours";
import { cn } from "@/components/ui";

/** The workbook's MACRO DATA sheet: every customer, when they were last invoiced, and whether new hours are waiting. */
function CustomersPage() {
  const dir = useDirectory();
  const { isManager } = useAuth();
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/time-entries")
      .then((r) => r.json())
      .then((j) => j.success && setEntries(j.data))
      .catch(() => {});
  }, []);

  const totals = useMemo(() => {
    const all = new Map<string, number>();
    const waiting = new Map<string, number>();
    for (const e of entries) {
      all.set(e.customerId, (all.get(e.customerId) ?? 0) + e.durationMinutes);
      if (e.isBillable && !e.isInvoiced && !e.isHeld) waiting.set(e.customerId, (waiting.get(e.customerId) ?? 0) + e.durationMinutes);
    }
    return { all, waiting };
  }, [entries]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dir.customers.filter((c) => (showArchived || c.isActive) && (!q || c.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  }, [dir.customers, query, showArchived]);

  const run = async <T,>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>) => {
    const r = await p;
    setError(r.ok ? null : r.error);
    return r;
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    if (dir.customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) return setError(`“${name}” already exists.`);
    const r = await run(dir.createCustomer(name));
    if (r.ok) setNewName("");
  };

  if (!dir.loaded) return <PageLoader label="Loading customers…" />;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Customers</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The short names you bill under (like <span className="font-mono">BLUE WHALE</span> or <span className="font-mono">HARBOR WTP</span>). Renaming one also renames it on past invoices.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex animate-m3-rise items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers…" aria-label="Search customers" className="h-9 w-full rounded-full border border-outline-variant bg-surface-low pl-8 pr-3 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          Show archived
        </label>
      </div>

      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
        <div className="stack-table-wrap m3-scroll max-h-[calc(100dvh-15rem)] min-h-[8rem] overflow-auto">
          <table className="stack-table w-full min-w-[44rem] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10">
              <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                <th>Customer</th>
                <th className="w-36">Last invoiced</th>
                <th className="w-32 text-right">Not yet invoiced</th>
                <th className="w-28 text-right">All hours</th>
                <th className="w-28">Status</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
              <tr className="bg-primary-container/40">
                <td data-label="Customer" className="span-2">
                  <input aria-label="New customer name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New customer — type a name and press Enter" className={cellBase} />
                </td>
                <td /><td /><td />
                <td className="px-2 text-[11px] font-medium text-primary">New row</td>
                <td className="actions-cell text-center">
                  <button onClick={add} aria-label="Add customer" disabled={!newName.trim()} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                </td>
              </tr>
              {list.map((c) => {
                const waiting = totals.waiting.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className={cn("group bg-card hover:bg-surface-low", !c.isActive && "opacity-60")}>
                    <td data-label="Customer" className="span-2"><TextCell aria-label="Customer name" value={c.name} onCommit={(v) => v.trim() && v.trim() !== c.name && run(dir.updateCustomer(c.id, { name: v.trim() }))} /></td>
                    <td data-label="Last invoiced" className="px-2 text-xs">{c.lastInvoiceDate ?? <span className="text-muted-foreground">never</span>}</td>
                    <td data-label="Not yet invoiced" className="px-2 text-right font-mono text-[13px] tabular-nums">
                      {waiting > 0 ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{fmtHours(waiting)} h</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td data-label="All hours" className="px-2 text-right font-mono text-[13px] tabular-nums">{fmtHours(totals.all.get(c.id) ?? 0)}</td>
                    <td data-label="Status" className="px-2">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", c.isActive ? "bg-tertiary-container text-tertiary-on-container" : "bg-surface-high text-muted-foreground")}>{c.isActive ? "Active" : "Archived"}</span>
                    </td>
                    <td className="actions-cell text-center">
                      {isManager && (
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => run(dir.updateCustomer(c.id, { isActive: !c.isActive }))} aria-label={c.isActive ? `Archive ${c.name}` : `Restore ${c.name}`} title={c.isActive ? "Archive" : "Restore"} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary">
                            {c.isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => confirm(`Delete “${c.name}”? This can't be undone.`) && run(dir.deleteCustomer(c.id))} aria-label={`Delete ${c.name}`} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr className="group-row"><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No customers match.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
          Customers with logged time can’t be deleted — archive them to hide them from the timesheet. {isManager ? "Edits save when you leave a cell." : "You can add and rename customers; accountants and admins can archive or delete them."}
        </div>
      </section>
    </div>
  );
}

export default function Page() {
  return <CustomersPage />;
}
