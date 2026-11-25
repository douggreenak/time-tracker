"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Plus, Printer, Trash2, X } from "lucide-react";
import type { InvoiceRecord } from "@/db/mock-data";
import { PageLoader } from "@/components/ui/loader";
import { cn } from "@/components/ui";
import { type InvoiceData, type PartRow, blankPart, money, partTotal, withParts } from "@/lib/invoice";

interface Row {
  customerId: string;
  customerName: string;
  isActive: boolean;
  lastInvoiceDate: string | null;
  newHours: boolean;
  unbilledHours: number;
  hoursInRange: number;
  entriesInRange: number;
  amountInRange: number;
}

const iso = (d: Date) => d.toLocaleDateString("en-CA");
const add = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const PRESETS: { id: string; label: string; range: () => [string, string] }[] = [
  { id: "this_week", label: "This week", range: () => { const n = new Date(); const s = add(n, -n.getDay()); return [iso(s), iso(add(s, 6))]; } },
  { id: "last_week", label: "Last week", range: () => { const n = new Date(); const s = add(n, -n.getDay() - 7); return [iso(s), iso(add(s, 6))]; } },
  { id: "this_month", label: "This month", range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(new Date(n.getFullYear(), n.getMonth() + 1, 0))]; } },
  { id: "last_month", label: "Last month", range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))]; } },
  { id: "ytd", label: "Year to date", range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), 0, 1)), iso(n)]; } },
];

const field = "h-9 rounded-full border border-outline-variant bg-surface-low px-3 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25";
const dateLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });

export default function BillingPage() {
    const [[from, to], setRange] = useState<[string, string]>(() => PRESETS[3].range());
  const [includeInvoiced, setIncludeInvoiced] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [everyone, setEveryone] = useState<{ id: string; name: string; isActive: boolean; lastInvoiceDate?: string | null }[]>([]);
  useEffect(() => { fetch("/api/customers").then((r) => r.json()).then((j) => j?.success && setEveryone(j.data)).catch(() => {}); }, []);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [invoices, setInvoices] = useState<InvoiceData[] | null>(null);
  const [parts, setParts] = useState<Record<string, PartRow[]>>({});
  const [history, setHistory] = useState<InvoiceRecord[]>([]);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    const j = await fetch("/api/invoices").then((r) => r.json()).catch(() => null);
    if (j?.success) setHistory(j.data);
  }, []);

  const loadRows = useCallback(async () => {
    const j = await fetch(`/api/billing/summary?from=${from}&to=${to}&includeInvoiced=${includeInvoiced}`).then((r) => r.json()).catch(() => null);
    if (j?.success) {
      setRows(j.data);
      setPicked(new Set((j.data as Row[]).filter((r) => r.entriesInRange > 0).map((r) => r.customerId)));
    } else setMsg({ type: "error", text: j?.error ?? "Couldn't load customers." });
    setInvoices(null);
  }, [from, to, includeInvoiced]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const body = (ids: string[]) => ({ from, to, includeInvoiced, customers: ids.map((id) => ({ id, parts: parts[id] ?? [] })) });
  const ids = useMemo(() => (rows ?? []).filter((r) => picked.has(r.customerId) && r.entriesInRange > 0).map((r) => r.customerId), [rows, picked]);

  const post = async (url: string, payload: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

  const create = async () => {
    setBusy(true);
    const j = await post("/api/billing/preview", body(ids)).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!j?.success) return setMsg({ type: "error", text: j?.error ?? "Couldn't build the invoices." });
    setInvoices(j.data);
    setMsg(null);
    setTimeout(() => document.getElementById("invoices")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const download = async (customerIds: string[], filename?: string) => {
    const res = await post("/api/billing/excel", body(customerIds));
    if (!res.ok) return setMsg({ type: "error", text: (await res.json().catch(() => null))?.error ?? "Couldn't build the Excel file." });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `Invoices_${from}_to_${to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markInvoiced = async (customerIds: string[]) => {
    const names = (invoices ?? []).filter((i) => customerIds.includes(i.customerId)).map((i) => i.customerName).join(", ");
    if (!confirm(`Mark the time on ${customerIds.length === 1 ? "this invoice" : `these ${customerIds.length} invoices`} as invoiced?\n\n${names}\n\nIt will be left out of future invoices.`)) return;
    setBusy(true);
    const res = await post("/api/invoices", body(customerIds));
    const j = await res.json().catch(() => null);
    setBusy(false);
    if (!j?.success) return setMsg({ type: "error", text: j?.error ?? "Couldn't record the invoices." });
    setMsg({ type: "success", text: `Recorded ${j.data.length} invoice${j.data.length === 1 ? "" : "s"}; that time is now marked invoiced.` });
    setInvoices(null);
    await Promise.all([loadRows(), loadHistory()]);
  };

  const undoInvoice = async (inv: InvoiceRecord) => {
    if (!confirm(`Delete the ${inv.customerName} invoice for ${dateLabel(inv.dateFrom)} – ${dateLabel(inv.dateTo)}? Its time goes back to “not invoiced” so it can be invoiced again.`)) return;
    const res = await fetch(`/api/invoices/${inv.id}`, { method: "DELETE" });
    if (!res.ok) return setMsg({ type: "error", text: "Couldn't delete that invoice." });
    setMsg({ type: "success", text: "Invoice deleted; its time is waiting to be invoiced again." });
    await Promise.all([loadRows(), loadHistory()]);
  };

  const setCustomerParts = (id: string, next: PartRow[]) => setParts((p) => ({ ...p, [id]: next }));

  if (!rows) return <PageLoader label="Loading billing…" />;
  // Only customers with time in the range, unless "Show all customers" adds the rest (greyed out, nothing to invoice).
  const shownRows: Row[] = showAll
    ? [...rows, ...everyone.filter((c) => !rows.some((r) => r.customerId === c.id)).map((c): Row => ({ customerId: c.id, customerName: c.name, isActive: c.isActive, lastInvoiceDate: c.lastInvoiceDate ?? null, newHours: false, unbilledHours: 0, hoursInRange: 0, entriesInRange: 0, amountInRange: 0 }))].sort((x, y) => x.customerName.localeCompare(y.customerName))
    : rows.filter((r) => r.entriesInRange > 0);
  const shown = (invoices ?? []).map((i) => withParts(i, parts[i.customerId] ?? []));

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-5 sm:px-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Billing</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pick a date range, choose the customers, and create one invoice sheet for each — the same as the workbook’s “create customer invoice sheets” macro. Billable time that isn’t held is priced at each person’s billing rate.
        </p>
      </div>

      {msg && (
        <div role="status" className={cn("flex animate-m3-rise items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-medium print:hidden", msg.type === "success" ? "bg-tertiary-container/60 text-tertiary-on-container" : "bg-destructive/10 text-destructive")}>
          <span className="flex items-center gap-2">{msg.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}{msg.text}</span>
          <button onClick={() => setMsg(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* 1 · dates and customers (the MACRO DATA sheet) */}
      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm print:hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-border/70 px-4 py-3">
          <label className="text-[11px] font-semibold text-muted-foreground">From
            <input type="date" aria-label="From date" value={from} onChange={(e) => e.target.value && setRange([e.target.value, to])} className={cn(field, "mt-1 block")} />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">To
            <input type="date" aria-label="To date" value={to} onChange={(e) => e.target.value && setRange([from, e.target.value])} className={cn(field, "mt-1 block")} />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick ranges">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => setRange(p.range())} className="h-9 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground">{p.label}</button>
            ))}
          </div>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={includeInvoiced} onChange={(e) => setIncludeInvoiced(e.target.checked)} data-testid="include-invoiced" className="accent-[hsl(var(--primary))]" />
            Include time already invoiced
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} data-testid="show-all-customers" className="accent-[hsl(var(--primary))]" />
            Show all customers
          </label>
        </div>

        <div className="stack-table-wrap m3-scroll max-h-[22rem] overflow-auto">
          <table className="stack-table w-full min-w-[44rem] border-separate border-spacing-0 text-left" data-testid="billing-table">
            <thead className="sticky top-0 z-10">
              <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                <th className="w-10">
                  <input type="checkbox" aria-label="Select all customers" checked={rows.filter((r) => r.entriesInRange > 0).every((r) => picked.has(r.customerId)) && rows.some((r) => r.entriesInRange > 0)}
                    onChange={(e) => setPicked(e.target.checked ? new Set(rows.filter((r) => r.entriesInRange > 0).map((r) => r.customerId)) : new Set())} className="accent-[hsl(var(--primary))]" />
                </th>
                <th>Customer</th><th className="w-36">Last invoiced</th><th className="w-32">New hours?</th><th className="w-28 text-right">Hours in range</th><th className="w-32 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
              {shownRows.map((r) => {
                const none = r.entriesInRange === 0;
                return (
                  <tr key={r.customerId} className={cn("bg-card hover:bg-surface-low", none && "opacity-60")} data-testid="billing-row">
                    <td className="px-2"><input type="checkbox" aria-label={`Invoice ${r.customerName}`} disabled={none} checked={picked.has(r.customerId) && !none}
                      onChange={() => setPicked((p) => { const n = new Set(p); n.has(r.customerId) ? n.delete(r.customerId) : n.add(r.customerId); return n; })} className="accent-[hsl(var(--primary))]" /></td>
                    <td data-label="Customer" className="px-2 py-2 text-[13px] font-medium">{r.customerName}</td>
                    <td data-label="Last invoiced" className="px-2 text-xs">{r.lastInvoiceDate ? dateLabel(r.lastInvoiceDate) : <span className="text-muted-foreground">never</span>}</td>
                    <td data-label="New hours?" className="px-2 text-xs">{r.newHours ? <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">TRUE · {r.unbilledHours.toFixed(1)} h</span> : <span className="text-muted-foreground">FALSE</span>}</td>
                    <td data-label="Hours in range" className="px-2 text-right font-mono text-[13px] tabular-nums">{none ? "—" : r.hoursInRange.toFixed(1)}</td>
                    <td data-label="Amount" className="px-2 text-right font-mono text-[13px] tabular-nums">{none ? "—" : `$${money(r.amountInRange)}`}</td>
                  </tr>
                );
              })}
              {shownRows.length === 0 && <tr className="group-row"><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No billable time in this range. Tick “Show all customers” to list everyone.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border/70 px-4 py-3">
          <button onClick={create} disabled={!ids.length || busy} data-testid="create-invoices" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-40">
            <FileSpreadsheet className="h-4 w-4" />Create invoices{ids.length ? ` (${ids.length})` : ""}
          </button>
          <span className="text-xs text-muted-foreground">Nothing is saved until you press “Mark as invoiced”.</span>
        </div>
      </section>

      {/* 2 · the invoice sheets */}
      {shown.length > 0 && (
        <div id="invoices" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <h2 className="text-lg font-semibold">Invoices · {dateLabel(from)} – {dateLabel(to)}</h2>
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={() => download(shown.map((i) => i.customerId))} data-testid="download-all" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold hover:bg-foreground/[0.05]"><Download className="h-3.5 w-3.5" />Download Excel (all)</button>
              <button onClick={() => window.print()} data-testid="print-all" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold hover:bg-foreground/[0.05]"><Printer className="h-3.5 w-3.5" />Print</button>
              <button onClick={() => markInvoiced(shown.map((i) => i.customerId))} disabled={busy} data-testid="mark-all" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" />Mark all as invoiced</button>
            </div>
          </div>
          {shown.map((inv) => (
            <InvoiceCard key={inv.customerId} inv={inv} parts={parts[inv.customerId] ?? []} onParts={(p) => setCustomerParts(inv.customerId, p)}
              onExcel={() => download([inv.customerId], `Invoice_${inv.customerName.replace(/[^A-Za-z0-9]+/g, "_")}_${from}_to_${to}.xlsx`)} onMark={() => markInvoiced([inv.customerId])} busy={busy} />
          ))}
        </div>
      )}

      {/* 3 · history */}
      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm print:hidden">
        <h2 className="border-b border-border/70 px-4 py-3 text-sm font-semibold">Invoice history</h2>
        <div className="m3-scroll max-h-72 overflow-auto">
          <table className="w-full text-left text-xs" data-testid="invoice-history">
            <tbody className="divide-y divide-border/60">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-surface-low">
                  <td className="px-4 py-2 text-[13px] font-medium">{h.customerName}</td>
                  <td className="px-2 text-muted-foreground">{dateLabel(h.dateFrom)} – {dateLabel(h.dateTo)}</td>
                  <td className="px-2 text-right font-mono tabular-nums">${money(h.total)}</td>
                  <td className="px-2 text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}{h.createdBy ? ` · ${h.createdBy}` : ""}</td>
                  <td className="px-2 text-right">
                    <a href={`/api/invoices/${h.id}/excel`} download aria-label={`Download ${h.customerName} invoice`} className="mr-1 inline-flex h-7 items-center gap-1 rounded-full px-2 font-semibold text-primary hover:bg-primary/10"><Download className="h-3.5 w-3.5" />Excel</a>
                    <button onClick={() => undoInvoice(h)} aria-label={`Delete ${h.customerName} invoice`} title="Delete invoice — its time becomes not invoiced again" className="inline-flex h-7 items-center gap-1 rounded-full px-2 font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground">No invoices recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* What the printer gets: one landscape page per invoice. */}
      <div className="hidden print:block" data-testid="print-invoices">
        {shown.map((inv) => (
          <div key={inv.customerId} className="print-sheet" style={{ breakAfter: "page" }}>
            <InvoiceTables inv={inv} />
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceCard({ inv, parts, onParts, onExcel, onMark, busy }: { inv: InvoiceData; parts: PartRow[]; onParts: (p: PartRow[]) => void; onExcel: () => void; onMark: () => void; busy: boolean }) {
  const set = (i: number, patch: Partial<PartRow>) => onParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(/[$,]/g, "")) || 0);
  return (
    <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm print:hidden" data-testid="invoice-card" aria-label={`Invoice for ${inv.customerName}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
        <h3 className="text-base font-semibold">{inv.customerName}</h3>
        <span className="text-xs text-muted-foreground">{inv.lines.length} line{inv.lines.length === 1 ? "" : "s"}</span>
        <span className="ml-auto font-mono text-lg font-semibold tabular-nums" data-testid="amount-due">${money(inv.amountDue)}</span>
        <button onClick={onExcel} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold hover:bg-foreground/[0.05]"><Download className="h-3.5 w-3.5" />Excel</button>
        <button onClick={onMark} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" />Mark as invoiced</button>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_16rem]">
        <div className="m3-scroll max-h-80 overflow-auto rounded-xl border border-border/70">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-container text-[11px] uppercase tracking-[0.06em] text-muted-foreground"><tr><th className="px-2 py-2">Date</th><th className="px-2 text-right">Hours</th><th className="px-2">Task</th><th className="px-2">Personnel</th><th className="px-2 text-right">Rate</th><th className="px-2 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-border/60">
              {inv.lines.map((l) => (
                <tr key={l.entryId}>
                  <td className="whitespace-nowrap px-2 py-1.5">{dateLabel(l.date)}</td>
                  <td className="px-2 text-right font-mono tabular-nums">{l.hours.toFixed(1)}</td>
                  <td className="px-2">{l.task}{l.isLumpSum && <span className="ml-1 rounded-full bg-secondary-container px-1.5 py-px text-[10px] font-semibold text-secondary-on-container">lump sum</span>}</td>
                  <td className="whitespace-nowrap px-2">{l.personnel}</td>
                  <td className="px-2 text-right font-mono tabular-nums">{money(l.rate)}</td>
                  <td className="px-2 text-right font-mono tabular-nums">{money(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-border/70">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Parts</span>
            <button onClick={() => onParts([...parts, blankPart()])} aria-label={`Add part for ${inv.customerName}`} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold text-primary hover:bg-primary/10"><Plus className="h-3.5 w-3.5" />Add part</button>
          </div>
          {inv.lines.some((l) => l.partsNote) && <p className="border-b border-border/70 bg-warning-container/40 px-3 py-1.5 text-[11px]">Time entries mention parts: {inv.lines.filter((l) => l.partsNote).map((l) => `${dateLabel(l.date)} — ${l.partsNote}`).join("; ")}</p>}
          <div className="space-y-2 p-3">
            {parts.length === 0 && <p className="text-xs text-muted-foreground">No parts on this invoice.</p>}
            {parts.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_3.5rem_5rem_1.75rem] gap-1.5">
                <input aria-label="Part item" placeholder="Item" value={p.item} onChange={(e) => set(i, { item: e.target.value })} className={cn(field, "h-8 rounded-lg")} />
                <input aria-label="Part quantity" inputMode="decimal" placeholder="Qty" value={String(p.qty)} onChange={(e) => set(i, { qty: num(e.target.value) })} className={cn(field, "h-8 rounded-lg text-right")} />
                <input aria-label="Part unit cost" inputMode="decimal" placeholder="Unit cost" value={p.unitCost ? String(p.unitCost) : ""} onChange={(e) => set(i, { unitCost: num(e.target.value) })} className={cn(field, "h-8 rounded-lg text-right")} />
                <button onClick={() => onParts(parts.filter((_, j) => j !== i))} aria-label="Remove part" className="inline-flex h-8 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                <input aria-label="Part description" placeholder="Description" value={p.desc} onChange={(e) => set(i, { desc: e.target.value })} className={cn(field, "col-span-3 h-8 rounded-lg")} />
                <span className="self-center text-right font-mono text-[11px] tabular-nums text-muted-foreground">{money(partTotal(p))}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/70 text-xs">
          <div className="border-b border-border/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Summary</div>
          <dl className="space-y-1.5 p-3">
            {inv.summary.map((s) => (
              <div key={s.personnel}>
                <div className="flex justify-between"><dt>LABOR HOURS ({s.personnel})</dt><dd className="font-mono tabular-nums">{s.hours.toFixed(1)}</dd></div>
                <div className="flex justify-between"><dt>LABOR TOTAL ({s.personnel}):</dt><dd className="font-mono tabular-nums">{money(s.total)}</dd></div>
              </div>
            ))}
            <div className="flex justify-between border-t border-border/70 pt-1.5"><dt>PARTS TOTAL:</dt><dd className="font-mono tabular-nums">{money(inv.partsTotal)}</dd></div>
            <div className="flex justify-between border-t-2 border-foreground/70 pt-1.5 text-sm font-semibold"><dt>INVOICE AMT. DUE:</dt><dd className="font-mono tabular-nums">{money(inv.amountDue)}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/** The plain version used for printing: labor, parts and summary on one sheet. */
function InvoiceTables({ inv }: { inv: InvoiceData }) {
  return (
    <>
      <h1 style={{ fontSize: "16pt", fontWeight: 700, margin: 0 }}>APEX ENGINEERING INVOICE DETAIL — {inv.customerName}</h1>
      <p style={{ margin: "2pt 0 8pt", fontSize: "9pt", color: "#444" }}>{dateLabel(inv.dateFrom)} – {dateLabel(inv.dateTo)}</p>
      <table className="print-table">
        <thead><tr><th>Date</th><th>Customer</th><th className="num">Hours</th><th>Task</th><th>Personnel</th><th className="num">Rate</th><th className="num">Total</th></tr></thead>
        <tbody>{inv.lines.map((l) => <tr key={l.entryId}><td>{dateLabel(l.date)}</td><td>{l.customer}</td><td className="num">{l.hours.toFixed(1)}</td><td>{l.task}</td><td>{l.personnel}</td><td className="num">{money(l.rate)}</td><td className="num">{money(l.total)}</td></tr>)}</tbody>
      </table>
      {inv.parts.length > 0 && (
        <>
          <h2>Parts</h2>
          <table className="print-table">
            <thead><tr><th>Item</th><th className="num">Qty</th><th>Description</th><th className="num">Unit cost</th><th className="num">Total cost</th></tr></thead>
            <tbody>{inv.parts.map((p, i) => <tr key={i}><td>{p.item}</td><td className="num">{p.qty}</td><td>{p.desc}</td><td className="num">{money(p.unitCost)}</td><td className="num">{money(partTotal(p))}</td></tr>)}</tbody>
          </table>
        </>
      )}
      <h2>Summary</h2>
      <table className="print-table">
        <tbody>
          {inv.summary.map((s) => <tr key={s.personnel}><td>LABOR HOURS ({s.personnel})</td><td className="num">{s.hours.toFixed(1)}</td><td>LABOR TOTAL ({s.personnel}):</td><td className="num">{money(s.total)}</td></tr>)}
          <tr><td colSpan={3}>PARTS TOTAL:</td><td className="num">{money(inv.partsTotal)}</td></tr>
        </tbody>
        <tfoot><tr><td colSpan={3}>INVOICE AMT. DUE:</td><td className="num">{money(inv.amountDue)}</td></tr></tfoot>
      </table>
    </>
  );
}
