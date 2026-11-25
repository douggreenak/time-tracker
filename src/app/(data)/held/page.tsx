"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowUpFromLine, Plus, Trash2, X } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { TextCell, cellBase } from "@/components/ui/cell";
import { Combobox } from "@/components/ui/combobox";
import { PageLoader } from "@/components/ui/loader";
import { useAuth } from "@/components/AuthProvider";
import { useDirectory } from "@/lib/useDirectory";
import { fmtHours, parseDuration } from "@/lib/hours";

/** The workbook's HELD TIME sheet: time that was worked but isn't to be billed yet, so invoices skip it. */
export default function HeldPage() {
  const dir = useDirectory();
  const { user, isManager } = useAuth();
  const [items, setItems] = useState<TimeEntryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ date: new Date().toLocaleDateString("en-CA"), customerId: "", hours: "", notes: "", partsNote: "" });

  const load = useCallback(async () => {
    const j = await fetch("/api/time-entries?held=true").then((r) => r.json()).catch(() => null);
    if (j?.success) setItems(j.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = async (url: string, method: string, body?: unknown) => {
    const j = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()).catch(() => null);
    setError(j?.success ? null : j?.error ?? "Something went wrong");
    await load();
    return Boolean(j?.success);
  };
  const customerOptions = dir.customers.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name }));

  const add = async () => {
    const min = parseDuration(draft.hours);
    if (min === null || min <= 0 || !user) return setError("Enter the hours first (e.g. 1.5).");
    if (await send("/api/time-entries", "POST", { userId: user.id, customerId: draft.customerId, date: draft.date, durationMinutes: Math.round(min / 6) * 6, notes: draft.notes, partsNote: draft.partsNote, isHeld: true }))
      setDraft({ ...draft, hours: "", notes: "", partsNote: "" });
  };
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && add();

  if (!items || !dir.loaded) return <PageLoader label="Loading held time…" />;
  const total = items.reduce((n, i) => n + i.durationMinutes, 0);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Held time</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Hours that were worked but aren’t being billed yet. Invoices skip them; “Release” puts a row back into normal billing.</p>
      </div>
      {error && (
        <div role="alert" className="flex animate-m3-rise items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}
      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
        <div className="stack-table-wrap m3-scroll max-h-[calc(100dvh-15rem)] min-h-[8rem] overflow-auto">
          <table className="stack-table w-full min-w-[56rem] border-separate border-spacing-0 text-left" data-testid="held-table">
            <thead className="sticky top-0 z-10">
              <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                <th className="w-40">Date</th><th className="w-48">Customer</th><th className="w-24 text-right">Hours</th><th>Description</th><th className="w-48">Parts</th><th className="w-28" />
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
              <tr className="bg-primary-container/40">
                <td data-label="Date"><input type="date" aria-label="New held date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={cellBase} /></td>
                <td data-label="Customer"><Combobox aria-label="New held customer" placeholder="Customer…" emptyLabel="— none —" value={draft.customerId} options={customerOptions} onSelect={(id) => setDraft({ ...draft, customerId: id })} /></td>
                <td data-label="Hours"><input aria-label="New held hours" inputMode="decimal" placeholder="1.5" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} onKeyDown={onEnter} className={`${cellBase} text-right font-mono tabular-nums`} /></td>
                <td data-label="Description" className="span-2"><input aria-label="New held description" placeholder="Description" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onKeyDown={onEnter} className={cellBase} /></td>
                <td data-label="Parts"><input aria-label="New held parts" placeholder="Parts" value={draft.partsNote} onChange={(e) => setDraft({ ...draft, partsNote: e.target.value })} onKeyDown={onEnter} className={cellBase} /></td>
                <td className="actions-cell text-center"><button onClick={add} aria-label="Add held time" className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-110"><Plus className="h-3.5 w-3.5" />Add</button></td>
              </tr>
              {items.map((e) => (
                <tr key={e.id} className="group bg-card hover:bg-surface-low">
                  <td data-label="Date"><TextCell type="date" aria-label="Date" value={e.date} onCommit={(v) => v && send(`/api/time-entries/${e.id}`, "PUT", { date: v })} /></td>
                  <td data-label="Customer"><Combobox aria-label="Customer" placeholder="— none —" emptyLabel="— none —" value={e.customerId} options={customerOptions} onSelect={(id) => send(`/api/time-entries/${e.id}`, "PUT", { customerId: id })} /></td>
                  <td data-label="Hours"><TextCell aria-label="Hours" inputMode="decimal" value={fmtHours(e.durationMinutes)} onCommit={(v) => { const m = parseDuration(v); if (m !== null && m > 0) send(`/api/time-entries/${e.id}`, "PUT", { durationMinutes: Math.round(m / 6) * 6 }); else setError("Hours must be a number."); }} className="text-right font-mono tabular-nums" /></td>
                  <td data-label="Description" className="span-2"><TextCell aria-label="Description" value={e.notes ?? ""} onCommit={(v) => send(`/api/time-entries/${e.id}`, "PUT", { notes: v })} /></td>
                  <td data-label="Parts"><TextCell aria-label="Parts" value={e.partsNote ?? ""} onCommit={(v) => send(`/api/time-entries/${e.id}`, "PUT", { partsNote: v })} /></td>
                  <td className="actions-cell text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => send(`/api/time-entries/${e.id}`, "PUT", { isHeld: false })} title="Release to billing" aria-label="Release to billing" className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-primary hover:bg-primary/10"><ArrowUpFromLine className="h-3.5 w-3.5" />Release</button>
                      {isManager && <button onClick={() => confirm("Delete this held time?") && send(`/api/time-entries/${e.id}`, "DELETE")} aria-label="Delete held time" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr className="group-row"><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No held time.</td></tr>}
            </tbody>
            {items.length > 0 && <tfoot><tr className="[&_td]:border-t [&_td]:border-border [&_td]:bg-surface-container"><td colSpan={2} className="h-9 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Total</td><td className="px-2 text-right font-mono text-[13px] font-semibold tabular-nums">{fmtHours(total)}</td><td colSpan={3} /></tr></tfoot>}
          </table>
        </div>
      </section>
    </div>
  );
}
