"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Plus, Trash2, X } from "lucide-react";
import type { BillingItem } from "@/db/mock-data";
import { TextCell, cellBase } from "@/components/ui/cell";
import { PageLoader } from "@/components/ui/loader";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/components/ui";
import { money } from "@/lib/invoice";

/** The workbook's LUMP SUM and OTHER sheets: a list of (customer, description, amount, notes). */
export function BillingItemsPage({ kind, title, blurb }: { kind: "lump_sum" | "other"; title: string; blurb: string }) {
  const { isManager } = useAuth();
  const [items, setItems] = useState<BillingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ customer: "", description: "", amount: "", notes: "" });

  const load = useCallback(async () => {
    const j = await fetch(`/api/billing-items?kind=${kind}`).then((r) => r.json()).catch(() => null);
    if (j?.success) setItems(j.data);
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  const send = async (url: string, method: string, body?: unknown) => {
    const j = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json()).catch(() => null);
    if (!j?.success) setError(j?.error ?? "Something went wrong");
    else setError(null);
    await load();
    return Boolean(j?.success);
  };

  const add = async () => {
    if (!draft.customer.trim() && !draft.description.trim()) return setError("Enter a customer or a description.");
    const amount = draft.amount.trim() === "" ? 0 : Number(draft.amount.replace(/[$,]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) return setError("Amount must be a number.");
    if (await send("/api/billing-items", "POST", { kind, ...draft, amount })) setDraft({ customer: "", description: "", amount: "", notes: "" });
  };
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && add();

  if (!items) return <PageLoader label="Loading…" />;
  const total = items.reduce((n, i) => n + i.amount, 0);

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{blurb}</p>
      </div>
      {error && (
        <div role="alert" className="flex animate-m3-rise items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}
      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
        <div className="stack-table-wrap m3-scroll max-h-[calc(100dvh-15rem)] min-h-[8rem] overflow-auto">
          <table className="stack-table w-full min-w-[52rem] border-separate border-spacing-0 text-left" data-testid={`${kind}-table`}>
            <thead className="sticky top-0 z-10">
              <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                <th className="w-48">Customer</th>
                <th>Description</th>
                <th className="w-32 text-right">Amount</th>
                <th className="w-64">Notes</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
              <tr className="bg-primary-container/40">
                <td data-label="Customer"><input aria-label="New customer" value={draft.customer} onChange={(e) => setDraft({ ...draft, customer: e.target.value })} onKeyDown={onEnter} placeholder="Customer" className={cellBase} /></td>
                <td data-label="Description" className="span-2"><input aria-label="New description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onKeyDown={onEnter} placeholder="Description" className={cellBase} /></td>
                <td data-label="Amount"><input aria-label="New amount" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} onKeyDown={onEnter} placeholder="0.00" className={cn(cellBase, "text-right font-mono tabular-nums")} /></td>
                <td data-label="Notes"><input aria-label="New notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onKeyDown={onEnter} placeholder="Notes" className={cellBase} /></td>
                <td className="actions-cell text-center"><button onClick={add} aria-label="Add row" className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-110"><Plus className="h-3.5 w-3.5" />Add</button></td>
              </tr>
              {items.map((i) => (
                <tr key={i.id} className="group bg-card hover:bg-surface-low">
                  <td data-label="Customer"><TextCell aria-label="Customer" value={i.customer} onCommit={(v) => send(`/api/billing-items/${i.id}`, "PUT", { customer: v })} /></td>
                  <td data-label="Description" className="span-2"><TextCell aria-label="Description" value={i.description} onCommit={(v) => send(`/api/billing-items/${i.id}`, "PUT", { description: v })} /></td>
                  <td data-label="Amount"><TextCell aria-label="Amount" inputMode="decimal" value={String(i.amount)} onCommit={(v) => { const n = Number(v.replace(/[$,]/g, "")); if (Number.isFinite(n) && n >= 0) send(`/api/billing-items/${i.id}`, "PUT", { amount: n }); else setError("Amount must be a number."); }} className="text-right font-mono tabular-nums" /></td>
                  <td data-label="Notes"><TextCell aria-label="Notes" value={i.notes} onCommit={(v) => send(`/api/billing-items/${i.id}`, "PUT", { notes: v })} /></td>
                  <td className="actions-cell text-center">
                    {isManager && <button onClick={() => confirm("Delete this row?") && send(`/api/billing-items/${i.id}`, "DELETE")} aria-label="Delete row" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr className="group-row"><td colSpan={5} className="py-10 text-center text-xs text-muted-foreground">Nothing here yet.</td></tr>}
            </tbody>
            {items.length > 0 && (
              <tfoot><tr className="[&_td]:border-t [&_td]:border-border [&_td]:bg-surface-container"><td colSpan={2} className="h-9 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Total</td><td className="px-2 text-right font-mono text-[13px] font-semibold tabular-nums">{money(total)}</td><td colSpan={2} /></tr></tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
