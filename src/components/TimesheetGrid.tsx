"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download, FoldVertical, Lock, Plus, Search, Trash2, Undo2, UnfoldVertical } from "lucide-react";
import type { CustomerItem, TimeEntryItem } from "@/db/mock-data";
import { cn } from "@/components/ui";
import { weekRangeLabel, weekStart, weekTag as weekTagOf } from "@/lib/weeks";
import { fmtHours, parseDuration } from "@/lib/hours";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { cellBase, TextCell } from "@/components/ui/cell";
import { HoursCalculator } from "@/components/HoursCalculator";

export { parseDuration };

const COLUMNS = [
  { key: "date", label: "Date", width: "w-[10.75rem]" },
  { key: "customer", label: "Customer", width: "w-[13rem]" },
  { key: "hours", label: "Hours", width: "w-[6rem]", numeric: true },
  { key: "description", label: "Description", width: "min-w-[18rem]" },
  { key: "lump", label: "Lump sum", width: "w-[5.5rem]", center: true },
  { key: "parts", label: "Parts", width: "w-[10rem]" },
  { key: "po", label: "Contract / PO", width: "w-[8.5rem]" },
  { key: "billable", label: "Billable", width: "w-[5rem]", center: true },
  { key: "invoiced", label: "Invoiced", width: "w-[6.5rem]" },
  { key: "actions", label: "", width: "w-[4.75rem]" },
] as const;

const today = () => new Date().toLocaleDateString("en-CA");
const dow = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });

interface Props {
  entries: TimeEntryItem[];
  setEntries: React.Dispatch<React.SetStateAction<TimeEntryItem[]>>;
  customers: CustomerItem[];
  userId: string;
  userName: string;
  isManager: boolean;
  onChanged: () => void;
  onMessage: (m: { type: "success" | "error"; text: string }) => void;
  /** Create-on-type: resolves to the new customer's id, or null if it failed. */
  onCreateCustomer: (name: string) => Promise<string | null>;
}

const blankDraft = () => ({ date: today(), customerId: "", hours: "", notes: "", isLumpSum: false, partsNote: "", contractPo: "", isBillable: true });

export function TimesheetGrid({ entries, setEntries, customers, userId, userName, isManager, onChanged, onMessage, onCreateCustomer }: Props) {
  const [query, setQuery] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(blankDraft);

  const latest = useRef({ draft, customers });
  latest.current = { draft, customers };
  const creating = useRef<Promise<unknown>>(Promise.resolve());
  const track = <T,>(p: Promise<T>) => {
    creating.current = p.catch(() => {});
    return p;
  };

  // Rows added a moment ago are shown at once and saved in the background; until saved they carry a temporary id.
  const PENDING = "pending-";
  const pendingEdits = useRef(new Map<string, Partial<TimeEntryItem>>());
  const cancelled = useRef(new Set<string>());

  const draftKey = `tt-draft-v2:${userId}`;
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [undo, setUndo] = useState<{ entry: TimeEntryItem } | null>(null);

  // The entry row autosaves locally, so a half-typed row survives a refresh or a stray navigation.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (saved) setDraft((d) => ({ ...d, ...saved, date: today() }));
    } catch {}
    setDraftLoaded(true);
  }, [draftKey]);
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      const { date: _date, ...rest } = draft;
      localStorage.setItem(draftKey, JSON.stringify(rest));
    } catch {}
  }, [draft, draftKey, draftLoaded]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  // If a chosen customer has since been removed, clear it.
  useEffect(() => {
    if (!draftLoaded) return;
    setDraft((d) => (d.customerId && !customers.some((c) => c.id === d.customerId) ? { ...d, customerId: "" } : d));
  }, [customers, draftLoaded]);

  const sorted = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((e) => [e.date, e.customerName, e.notes, e.partsNote, e.contractPo, e.internalNote].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [sorted, query]);

  const stats = useMemo(() => {
    const t = today();
    const wk = weekStart(t);
    let day = 0, week = 0, billable = 0, total = 0, waiting = 0;
    for (const e of entries) {
      total += e.durationMinutes;
      if (e.isBillable) billable += e.durationMinutes;
      if (e.isBillable && !e.isInvoiced && !e.isHeld) waiting += e.durationMinutes;
      if (e.date === t) day += e.durationMinutes;
      if (weekStart(e.date) === wk) week += e.durationMinutes;
    }
    return { day, week, billable, total, waiting };
  }, [entries]);

  const shownMinutes = visible.reduce((n, e) => n + e.durationMinutes, 0);
  const shownBillable = visible.reduce((n, e) => n + (e.isBillable ? e.durationMinutes : 0), 0);

  const customerOptions = (currentId?: string): ComboOption[] => customers.filter((c) => c.isActive || c.id === currentId).map((c) => ({ id: c.id, label: c.name }));

  // ---- editing existing rows -------------------------------------------------
  const patchEntry = async (entry: TimeEntryItem, patch: Partial<TimeEntryItem>) => {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)));
    if (entry.id.startsWith(PENDING)) {
      pendingEdits.current.set(entry.id, { ...pendingEdits.current.get(entry.id), ...patch });
      return;
    }
    try {
      const res = await fetch(`/api/time-entries/${entry.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Update failed");
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? json.data : e)));
    } catch (err) {
      onMessage({ type: "error", text: err instanceof Error ? err.message : "Could not save change" });
      onChanged(); // roll back to server state
    }
  };

  const changeCustomer = (entry: TimeEntryItem, customerId: string) => {
    const c = customers.find((x) => x.id === customerId);
    patchEntry(entry, { customerId: c?.id ?? "", customerName: c?.name ?? "" });
  };

  const commitHours = (entry: TimeEntryItem, raw: string) => {
    const min = parseDuration(raw);
    if (min === null || (min <= 0 && !entry.isLumpSum)) {
      onMessage({ type: "error", text: `"${raw}" isn't a valid number of hours. Try 1.5, 1:30 or 2h 15m.` });
      setEntries((prev) => [...prev]); // snap the cell back
      return;
    }
    const tenths = Math.round(min / 6) * 6;
    if (tenths !== entry.durationMinutes) patchEntry(entry, { durationMinutes: tenths });
  };

  const deleteEntry = async (entry: TimeEntryItem) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    if (entry.id.startsWith(PENDING)) {
      cancelled.current.add(entry.id);
      return;
    }
    try {
      const res = await fetch(`/api/time-entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setUndo({ entry });
    } catch {
      onMessage({ type: "error", text: "Could not delete entry" });
      onChanged();
    }
  };

  const undoDelete = async () => {
    if (!undo) return;
    const e = undo.entry;
    setUndo(null);
    const res = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: e.userId, customerId: e.customerId, date: e.date, durationMinutes: e.durationMinutes, notes: e.notes ?? "",
        isLumpSum: e.isLumpSum, partsNote: e.partsNote ?? "", internalNote: e.internalNote ?? "", contractPo: e.contractPo ?? "",
        isBillable: e.isBillable, isHeld: e.isHeld,
      }),
    });
    const json = await res.json().catch(() => null);
    if (json?.success) onChanged();
    else onMessage({ type: "error", text: "Couldn't restore that row." });
  };

  /** Copy a row's details into the entry row so a similar entry is one number away. */
  const copyToNewRow = (e: TimeEntryItem) => {
    setDraft({ date: e.date, customerId: e.customerId, hours: "", notes: e.notes ?? "", isLumpSum: e.isLumpSum, partsNote: e.partsNote ?? "", contractPo: e.contractPo ?? "", isBillable: e.isBillable });
    setTimeout(() => focusCell("new", "hours"), 0);
  };

  // ---- the entry row ---------------------------------------------------------
  const addEntry = async () => {
    await creating.current; // a customer typed a moment ago may still be saving
    await new Promise((r) => setTimeout(r, 0));
    const { draft, customers } = latest.current;
    const min = parseDuration(draft.hours);
    if (min === null || (min <= 0 && !draft.isLumpSum)) {
      onMessage({ type: "error", text: "Enter the hours first (e.g. 1.5, 1:30 or 2h 15m)." });
      focusCell("new", "hours");
      return;
    }
    const tenths = Math.round(min / 6) * 6;
    const cust = customers.find((c) => c.id === draft.customerId);
    const customerId = cust?.id ?? "";
    const tempId = `${PENDING}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp: TimeEntryItem = {
      id: tempId, userId, userName, customerId, customerName: cust?.name ?? "", date: draft.date, durationMinutes: tenths,
      notes: draft.notes, isLumpSum: draft.isLumpSum, partsNote: draft.partsNote, internalNote: "", contractPo: draft.contractPo,
      isBillable: draft.isBillable, isInvoiced: false, invoicedOn: null, isHeld: false, createdAt: new Date().toISOString(),
    };
    const keep = { hours: draft.hours, notes: draft.notes };
    setEntries((prev) => [temp, ...prev]);
    setWeekOpen(weekStart(draft.date), true);
    setDraft((d) => ({ ...d, hours: "", notes: "", partsNote: "", contractPo: "", isLumpSum: false }));
    setTimeout(() => focusCell("new", "hours"), 0);

    const drop = () => setEntries((prev) => prev.filter((e) => e.id !== tempId));
    (async () => {
      try {
        const res = await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId, customerId, date: draft.date, durationMinutes: tenths, notes: draft.notes, isLumpSum: draft.isLumpSum,
            partsNote: draft.partsNote, contractPo: draft.contractPo, isBillable: draft.isBillable,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to add entry");
        const saved = json.data as TimeEntryItem;
        if (cancelled.current.delete(tempId)) {
          pendingEdits.current.delete(tempId);
          fetch(`/api/time-entries/${saved.id}`, { method: "DELETE" }).catch(() => {});
          return;
        }
        setEntries((prev) => prev.map((e) => (e.id === tempId ? saved : e)));
        const edits = pendingEdits.current.get(tempId);
        if (edits) {
          pendingEdits.current.delete(tempId);
          patchEntry(saved, edits);
        }
      } catch (err) {
        drop();
        setDraft((d) => (d.hours || d.notes ? d : { ...d, hours: keep.hours, notes: keep.notes }));
        onMessage({ type: "error", text: `Couldn't save that entry (${err instanceof Error ? err.message : "network problem"}). It's back in the entry row — press Enter to retry.` });
      }
    })();
  };

  // ---- keyboard navigation (Enter / ↑ / ↓ move between rows, like a sheet) ------
  const focusCell = (row: string, col: string) => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-r="${row}"][data-c="${col}"]`);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement && el.type === "text") el.select();
    }
    return !!el;
  };

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    const row = el.dataset.r;
    const col = el.dataset.c;
    if (!row || !col) return;
    const isDate = el instanceof HTMLInputElement && el.type === "date";
    const isCheckbox = el instanceof HTMLInputElement && el.type === "checkbox";

    let step = 0;
    if (e.key === "Enter" && !isCheckbox) {
      if (row === "new" && !e.shiftKey) {
        e.preventDefault();
        addEntry();
        return;
      }
      step = e.shiftKey ? -1 : 1;
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isDate && !isCheckbox) {
      step = e.key === "ArrowDown" ? 1 : -1;
    } else return;

    e.preventDefault();
    if (row === "new") {
      if (step > 0 && rendered.length) focusCell(rendered[0].id, col);
      return;
    }
    const idx = rendered.findIndex((v) => v.id === row);
    const next = idx + step;
    if (next < 0) focusCell("new", col);
    else if (next < rendered.length) focusCell(rendered[next].id, col);
  };

  // ---- collapsible weeks ---------------------------------------------------------
  const thisWeek = weekStart(today());
  // Open/closed choices last only for this visit: every load starts with just the current week open.
  const [weekOverride, setWeekOverrideState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      localStorage.removeItem("tt-weeks-v1");
    } catch {}
  }, []);
  const setWeekOpen = (wk: string, open: boolean) => setWeekOverrideState((prev) => ({ ...prev, [wk]: open }));
  const isWeekOpen = (wk: string) => (query.trim() ? true : weekOverride[wk] ?? wk === thisWeek);

  const weeks = useMemo(() => {
    const m = new Map<string, { minutes: number; billable: number; waiting: number; count: number }>();
    visible.forEach((e) => {
      const wk = weekStart(e.date);
      const w = m.get(wk) ?? { minutes: 0, billable: 0, waiting: 0, count: 0 };
      w.minutes += e.durationMinutes;
      if (e.isBillable) w.billable += e.durationMinutes;
      if (e.isBillable && !e.isInvoiced) w.waiting += e.durationMinutes;
      w.count += 1;
      m.set(wk, w);
    });
    return m;
  }, [visible]);

  const allWeeks = Array.from(weeks.keys());
  const anyClosed = allWeeks.some((w) => !isWeekOpen(w));
  const setAllWeeks = (open: boolean) => setWeekOverrideState(() => Object.fromEntries(allWeeks.map((w) => [w, open])));

  const rendered = useMemo(() => visible.filter((e) => isWeekOpen(weekStart(e.date))), [visible, weekOverride, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayGroups = useMemo(() => {
    const totals = new Map<string, number>();
    visible.forEach((e) => totals.set(e.date, (totals.get(e.date) ?? 0) + e.durationMinutes));
    return totals;
  }, [visible]);

  const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const check = "h-4 w-4 cursor-pointer accent-[hsl(var(--primary))] disabled:cursor-not-allowed";

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border/70 px-4 py-3">
        <Stat label="Today" value={stats.day} />
        <Stat label="This week" value={stats.week} />
        <Stat label="Billable" value={stats.billable} sub={stats.total ? `${Math.round((stats.billable / stats.total) * 100)}%` : undefined} />
        <Stat label="Waiting to invoice" value={stats.waiting} />
        <Stat label="All logged" value={stats.total} />
        <WeekBars entries={entries} />
        <div className="ml-auto flex flex-wrap items-center gap-2 max-sm:ml-0">
          <HoursCalculator onUse={(h) => { setDraft((d) => ({ ...d, hours: h })); setTimeout(() => focusCell("new", "hours"), 0); }} />
          {allWeeks.length > 0 && (
            <button
              type="button"
              onClick={() => setAllWeeks(anyClosed)}
              data-testid="weeks-toggle-all"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
            >
              {anyClosed ? <UnfoldVertical className="h-3.5 w-3.5" /> : <FoldVertical className="h-3.5 w-3.5" />}
              {anyClosed ? "Expand all weeks" : "Collapse all weeks"}
            </button>
          )}
          <a
            href={`/api/export/csv?userId=${userId}`}
            download
            title="Download this time log as a spreadsheet (CSV)"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />Export CSV
          </a>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows…"
            aria-label="Filter timesheet rows"
            className="h-9 w-full rounded-full border border-outline-variant bg-surface-low pl-8 pr-3 text-xs outline-none transition-colors hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>

      <div ref={gridRef} onKeyDown={onGridKeyDown} className="stack-table-wrap m3-scroll h-[calc(100dvh-21.5rem)] min-h-[16rem] overflow-auto">
        <table className="stack-table w-full min-w-[66rem] border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-20">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "h-9 border-b border-r border-border bg-surface-container px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground last:border-r-0",
                    c.width,
                    "numeric" in c && c.numeric && "text-right",
                    "center" in c && c.center && "text-center"
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
            {/* New-entry row */}
            <tr className="sticky top-9 z-10 bg-primary-container/40 backdrop-blur" data-new-row>
              <td data-label="Date" className="max-md:order-1">
                <input type="date" aria-label="New entry date" data-r="new" data-c="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={cellBase} />
              </td>
              <td data-label="Customer" className="span-2 max-md:order-3">
                <Combobox
                  aria-label="New entry customer"
                  data-r="new"
                  data-c="customer"
                  placeholder="Customer…"
                  emptyLabel="— no customer —"
                  value={draft.customerId}
                  options={customerOptions()}
                  onSelect={(id) => setDraft({ ...draft, customerId: id })}
                  onCreate={async (name) => {
                    const id = await track(onCreateCustomer(name));
                    if (id) setDraft((d) => ({ ...d, customerId: id }));
                  }}
                />
              </td>
              <td data-label="Hours" className="max-md:order-2">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="New entry hours"
                  data-r="new"
                  data-c="hours"
                  placeholder="1.5 · 1:30"
                  value={draft.hours}
                  onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
                  className={cn(cellBase, "text-right font-mono tabular-nums")}
                />
              </td>
              <td data-label="Description" className="span-2 max-md:order-4">
                <input type="text" aria-label="New entry description" data-r="new" data-c="notes" placeholder="Description" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={cellBase} />
              </td>
              <td data-label="Lump sum" className="text-center max-md:order-5 max-md:text-left">
                <input type="checkbox" aria-label="New entry lump sum" data-r="new" data-c="lump" checked={draft.isLumpSum} onChange={(e) => setDraft({ ...draft, isLumpSum: e.target.checked })} className={check} />
              </td>
              <td data-label="Parts" className="max-md:order-6">
                <input type="text" aria-label="New entry parts" data-r="new" data-c="parts" placeholder="Parts used / prices" value={draft.partsNote} onChange={(e) => setDraft({ ...draft, partsNote: e.target.value })} className={cellBase} />
              </td>
              <td data-label="Contract / PO" className="max-md:order-7">
                <input type="text" aria-label="New entry contract or PO" data-r="new" data-c="po" placeholder="Contract / PO" value={draft.contractPo} onChange={(e) => setDraft({ ...draft, contractPo: e.target.value })} className={cellBase} />
              </td>
              <td data-label="Billable" className="text-center max-md:order-8 max-md:text-left">
                <input type="checkbox" aria-label="New entry billable" data-r="new" data-c="billable" checked={draft.isBillable} onChange={(e) => setDraft({ ...draft, isBillable: e.target.checked })} className={check} />
              </td>
              <td data-label="Invoiced" className="cell-hide-mobile px-2 text-[11px] font-medium text-primary max-md:order-9">New entry</td>
              <td className="actions-cell text-center max-md:order-10">
                <button
                  type="button"
                  onClick={addEntry}
                  title="Add entry (Enter)"
                  aria-label="Add entry"
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />Add
                </button>
              </td>
            </tr>

            {/* A little breathing room between the entry form and the weeks below it. */}
            <tr aria-hidden="true" className="group-row max-md:hidden" data-testid="entry-week-gap">
              <td colSpan={COLUMNS.length} className="h-4 border-b border-border bg-surface-container/60 p-0" />
            </tr>

            {visible.map((e, i) => {
              const locked = e.isInvoiced && !isManager; // invoiced time can be fixed but only a manager removes it
              const wk = weekStart(e.date);
              const firstOfWeek = i === 0 || weekStart(visible[i - 1].date) !== wk;
              const weekOpen = isWeekOpen(wk);
              const firstOfDay = i === 0 || visible[i - 1].date !== e.date || firstOfWeek;
              const w = weeks.get(wk)!;
              const weekHeader = firstOfWeek && (
                <tr className="group-row week-row" data-week={wk}>
                  <td colSpan={COLUMNS.length} className="border-y border-border border-l-4 border-l-primary bg-primary/[0.13] p-0">
                    <button
                      type="button"
                      onClick={() => setWeekOpen(wk, !weekOpen)}
                      aria-expanded={weekOpen}
                      aria-label={`${weekOpen ? "Collapse" : "Expand"} week of ${weekRangeLabel(wk)}`}
                      data-testid="week-toggle"
                      className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
                    >
                      {weekOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="text-[13px] font-semibold">{weekRangeLabel(wk)}</span>
                      {weekTagOf(wk) && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{weekTagOf(wk)}</span>}
                      <span className="font-mono text-[13px] font-semibold tabular-nums" data-testid="week-hours">{fmtHours(w.minutes)} h</span>
                      <span className="text-[11px] text-muted-foreground">{fmtHours(w.billable)} h billable · {w.count} {w.count === 1 ? "entry" : "entries"}</span>
                      {w.waiting > 0 && <span className="ml-auto rounded-full bg-surface-high px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{fmtHours(w.waiting)} h not invoiced</span>}
                    </button>
                  </td>
                </tr>
              );
              if (!weekOpen) return firstOfWeek ? <RowGroup key={`wk-${wk}`}>{weekHeader}</RowGroup> : null;
              return (
                <RowGroup key={e.id}>
                  {weekHeader}
                  {firstOfDay && (
                    <tr className="group-row day-row">
                      <td colSpan={COLUMNS.length} className="border-l-[3px] border-l-primary/50 bg-primary/[0.055] py-1.5 pl-7 pr-2 text-[11px] font-semibold text-foreground/70">
                        {fmtDay(e.date)}
                        <span className="ml-2 font-mono font-medium tabular-nums">{fmtHours(dayGroups.get(e.date) ?? 0)}h</span>
                      </td>
                    </tr>
                  )}
                  <tr className={cn("entry-row group bg-card hover:bg-surface-low", e.id.startsWith(PENDING) && "opacity-70")}>
                    <td data-label="Date" className="border-l-[3px] border-l-primary/15 pl-4 max-md:order-1">
                      <TextCell type="date" aria-label="Date" data-r={e.id} data-c="date" value={e.date} onCommit={(v) => v && patchEntry(e, { date: v })} />
                    </td>
                    <td data-label="Customer" className="span-2 max-md:order-3">
                      <Combobox
                        aria-label="Customer"
                        data-r={e.id}
                        data-c="customer"
                        placeholder="— no customer —"
                        emptyLabel="— no customer —"
                        value={e.customerId}
                        options={customerOptions(e.customerId)}
                        onSelect={(id) => changeCustomer(e, id)}
                        onCreate={async (name) => {
                          const id = await track(onCreateCustomer(name));
                          if (id) changeCustomer(e, id);
                        }}
                      />
                    </td>
                    <td data-label="Hours" className="max-md:order-2">
                      <TextCell type="text" inputMode="decimal" aria-label="Hours" data-r={e.id} data-c="hours" value={fmtHours(e.durationMinutes)} onCommit={(v) => commitHours(e, v)} className="text-right font-mono tabular-nums" />
                    </td>
                    <td data-label="Description" className="span-2 max-md:order-4">
                      <TextCell type="text" aria-label="Description" data-r={e.id} data-c="notes" value={e.notes ?? ""} onCommit={(v) => patchEntry(e, { notes: v })} />
                    </td>
                    <td data-label="Lump sum" className="text-center max-md:order-5 max-md:text-left">
                      <input type="checkbox" aria-label="Lump sum" data-r={e.id} data-c="lump" checked={e.isLumpSum} onChange={(ev) => patchEntry(e, { isLumpSum: ev.target.checked })} className={check} />
                    </td>
                    <td data-label="Parts" className="max-md:order-6">
                      <TextCell type="text" aria-label="Parts" data-r={e.id} data-c="parts" value={e.partsNote ?? ""} onCommit={(v) => patchEntry(e, { partsNote: v })} />
                    </td>
                    <td data-label="Contract / PO" className="max-md:order-7">
                      <TextCell type="text" aria-label="Contract or PO" data-r={e.id} data-c="po" value={e.contractPo ?? ""} onCommit={(v) => patchEntry(e, { contractPo: v })} />
                    </td>
                    <td data-label="Billable" className="text-center max-md:order-8 max-md:text-left">
                      <input type="checkbox" aria-label="Billable" data-r={e.id} data-c="billable" checked={e.isBillable} onChange={(ev) => patchEntry(e, { isBillable: ev.target.checked })} className={check} />
                    </td>
                    <td data-label="Invoiced" className="px-2 max-md:order-9">
                      {e.isInvoiced ? (
                        <button
                          type="button"
                          onClick={() => isManager && patchEntry(e, { isInvoiced: false })}
                          disabled={!isManager}
                          title={isManager ? "Click to mark as not invoiced" : `Invoiced${e.invoicedOn ? ` on ${e.invoicedOn}` : ""}`}
                          aria-label={`Invoiced${e.invoicedOn ? ` ${e.invoicedOn}` : ""}`}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-secondary-on-container disabled:cursor-default"
                        >
                          {locked && <Lock className="h-3 w-3" />}Invoiced
                        </button>
                      ) : !e.isBillable ? (
                        <span className="text-[11px] text-muted-foreground">Not billable</span>
                      ) : e.isHeld ? (
                        <span className="rounded-full bg-surface-high px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Held</span>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">To invoice</span>
                      )}
                    </td>
                    <td className="actions-cell px-1 max-md:order-10">
                      <div className="flex items-center justify-center gap-0.5">
                        <button type="button" onClick={() => copyToNewRow(e)} title="Copy details to the new-entry row" aria-label="Copy row" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {locked ? (
                          <span title="Invoiced time can be edited but only an accountant or admin can delete it" className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground/40">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <button type="button" onClick={() => deleteEntry(e)} title="Delete row" aria-label="Delete row" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                </RowGroup>
              );
            })}

            {visible.length === 0 && (
              <tr className="group-row">
                <td colSpan={COLUMNS.length} className="py-10 text-center text-xs text-muted-foreground">
                  {entries.length === 0 ? "No time logged yet — fill in the blue row above and press Enter." : "No rows match your filter."}
                </td>
              </tr>
            )}
          </tbody>

          <tfoot className="sticky bottom-0 z-10 max-md:static">
            <tr className="[&_td]:border-t [&_td]:border-border [&_td]:bg-surface-container">
              <td colSpan={2} className="span-2 h-9 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Total</td>
              <td className="px-2 text-right font-mono text-[13px] font-semibold tabular-nums">{fmtHours(shownMinutes)}</td>
              <td colSpan={7} className="span-2 px-2 text-[11px] text-muted-foreground">{fmtHours(shownBillable)}h billable</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {undo && (
        <div role="status" className="absolute bottom-12 left-1/2 z-30 flex -translate-x-1/2 animate-m3-rise items-center gap-3 rounded-full bg-foreground py-2 pl-4 pr-2 text-xs font-medium text-background shadow-xl">
          <span>Deleted {fmtHours(undo.entry.durationMinutes)}h for {undo.entry.customerName || "no customer"}</span>
          <button onClick={undoDelete} className="inline-flex items-center gap-1 rounded-full bg-background/15 px-3 py-1 font-semibold transition hover:bg-background/25">
            <Undo2 className="h-3.5 w-3.5" />Undo
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
        <span><kbd className="font-mono font-semibold text-foreground">Tab</kbd> next cell</span>
        <span><kbd className="font-mono font-semibold text-foreground">Enter</kbd> / <kbd className="font-mono font-semibold text-foreground">↓</kbd> cell below</span>
        <span><kbd className="font-mono font-semibold text-foreground">Esc</kbd> undo edit</span>
        <span>Hours are kept in tenths: <span className="font-mono">1.5</span>, <span className="font-mono">1:30</span>, <span className="font-mono">2h 15m</span></span>
        <span>Everything autosaves</span>
      </div>
    </section>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Sun–Sat mini chart for the current week; the dashed line marks an 8h day. */
function WeekBars({ entries }: { entries: TimeEntryItem[] }) {
  const days = useMemo(() => {
    const start = new Date(`${weekStart(today())}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toLocaleDateString("en-CA");
      const minutes = entries.filter((e) => e.date === key).reduce((n, e) => n + e.durationMinutes, 0);
      return { key, minutes, label: d.toLocaleDateString(undefined, { weekday: "narrow" }), isToday: key === today() };
    });
  }, [entries]);
  const scale = Math.max(480, ...days.map((d) => d.minutes));
  return (
    <div className="flex flex-col gap-0.5" aria-label="Hours this week">
      <div className="relative flex h-10 items-end gap-1">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-outline-variant" style={{ bottom: `${(480 / scale) * 100}%` }} />
        {days.map((d) => (
          <div key={d.key} className="flex h-full w-4 flex-col items-center justify-end gap-0.5" title={`${dow(d.key)} ${d.key}: ${fmtHours(d.minutes)}h`}>
            <div
              className={cn("w-full rounded-t-[3px] transition-[height,background-color] duration-300 ease-expressive", d.isToday ? "bg-primary" : d.minutes ? "bg-primary/45" : "bg-surface-high")}
              style={{ height: `${Math.max(d.minutes ? 8 : 3, (d.minutes / scale) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {days.map((d) => (
          <span key={d.key} className={cn("w-4 text-center text-[9px] font-medium", d.isToday ? "text-primary" : "text-muted-foreground")}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="m3-label">{label}</span>
      <span className="m3-metric text-lg leading-tight text-foreground">
        {fmtHours(value)}
        <span className="ml-0.5 text-xs font-medium text-muted-foreground">h</span>
        {sub && <span className="ml-2 text-xs font-medium text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}
