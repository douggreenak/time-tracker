"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Flag, Lock, Plus, Search, Trash2, Undo2 } from "lucide-react";
import type { CustomerItem, ServiceItem, TimeEntryItem } from "@/db/mock-data";
import { cn } from "@/components/ui";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { cellBase, TextCell } from "@/components/ui/cell";

type LocationType = TimeEntryItem["locationType"];
type Status = TimeEntryItem["status"];

const LOCATIONS: { id: LocationType; label: string }[] = [
  { id: "on_site", label: "On-site" },
  { id: "office", label: "Office" },
  { id: "remote", label: "Remote" },
  { id: "travel", label: "Travel" },
];

const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-surface-high text-muted-foreground",
  submitted: "bg-primary-container text-primary-on-container",
  approved: "bg-tertiary-container text-tertiary-on-container",
  exported: "bg-secondary-container text-secondary-on-container",
};

const COLUMNS = [
  { key: "date", label: "Date", width: "w-[9.5rem]" },
  { key: "customer", label: "Customer", width: "w-[13rem]" },
  { key: "job", label: "Job", width: "w-[11rem]" },
  { key: "service", label: "Task", width: "w-[12rem]" },
  { key: "location", label: "Location", width: "w-[7.5rem]" },
  { key: "hours", label: "Hours", width: "w-[6.5rem]", numeric: true },
  { key: "billable", label: "Bill", width: "w-[3.5rem]", center: true },
  { key: "notes", label: "Notes", width: "min-w-[16rem]" },
  { key: "status", label: "Status", width: "w-[6.5rem]" },
  { key: "actions", label: "", width: "w-[5.75rem]" },
] as const;

/** Accepts "1.5", "1:30", "90m", "2h", "2h 15m". Returns minutes, or null if unreadable. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:s|utes)?)?)?$/);
  if (m && (m[1] || m[2])) return Math.round(Number(m[1] || 0) * 60 + Number(m[2] || 0));
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 60);
  return null;
}

const fmtHours = (min: number) => (min / 60).toFixed(2);
const today = () => new Date().toISOString().split("T")[0];

/** Monday-based start of the week for a YYYY-MM-DD string. */
function weekStart(d: string) {
  const dt = new Date(`${d}T00:00:00`);
  const diff = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - diff);
  return dt.toLocaleDateString("en-CA");
}

interface Props {
  entries: TimeEntryItem[];
  setEntries: React.Dispatch<React.SetStateAction<TimeEntryItem[]>>;
  customers: CustomerItem[];
  serviceItems: ServiceItem[];
  userId: string;
  userName: string;
  onChanged: () => void;
  onMessage: (m: { type: "success" | "error"; text: string }) => void;
  /** Create-on-type: each resolves to the new record's id, or null if it failed. */
  onCreateCustomer: (name: string) => Promise<string | null>;
  onCreateJob: (customerId: string, name: string) => Promise<string | null>;
  onCreateService: (name: string) => Promise<string | null>;
}

export function TimesheetGrid({
  entries,
  setEntries,
  customers,
  serviceItems,
  userId,
  userName,
  onChanged,
  onMessage,
  onCreateCustomer,
  onCreateJob,
  onCreateService,
}: Props) {
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState({
    date: today(),
    customerId: "",
    jobId: "",
    serviceItemId: "",
    locationType: "office" as LocationType,
    hours: "",
    isBillable: true,
    notes: "",
  });

  // Latest values for async handlers, plus any create-on-type still in flight.
  const latest = useRef({ draft, customers, serviceItems });
  latest.current = { draft, customers, serviceItems };
  const creating = useRef<Promise<unknown>>(Promise.resolve());
  const track = <T,>(p: Promise<T>) => {
    creating.current = p.catch(() => {});
    return p;
  };

  const draftKey = `tt-draft-v1:${userId}`;
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

  // Seed the entry row once reference data arrives (and if the chosen ones disappear).
  useEffect(() => {
    if (!draftLoaded) return;
    setDraft((d) => {
      const custOk = customers.some((c) => c.id === d.customerId);
      const cust = custOk ? d.customerId : customers.find((c) => c.isActive)?.id ?? "";
      const jobOk = !d.jobId || customers.find((c) => c.id === cust)?.jobs.some((j) => j.id === d.jobId);
      const srvCurrent = serviceItems.find((x) => x.id === d.serviceItemId);
      const srv = srvCurrent ?? serviceItems[0];
      if (cust === d.customerId && jobOk && srv?.id === d.serviceItemId) return d;
      return {
        ...d,
        customerId: cust,
        jobId: jobOk ? d.jobId : "",
        serviceItemId: srv?.id ?? "",
        isBillable: srvCurrent ? d.isBillable : srv?.defaultBillable ?? true,
      };
    });
  }, [customers, serviceItems, draftLoaded]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [entries]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((e) =>
      [e.date, e.customerName, e.jobName, e.serviceItemName, e.notes, e.locationType, e.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [sorted, query]);

  const stats = useMemo(() => {
    const t = today();
    const wk = weekStart(t);
    let day = 0, week = 0, billable = 0, total = 0;
    for (const e of entries) {
      total += e.durationMinutes;
      if (e.isBillable) billable += e.durationMinutes;
      if (e.date === t) day += e.durationMinutes;
      if (weekStart(e.date) === wk) week += e.durationMinutes;
    }
    return { day, week, billable, total };
  }, [entries]);

  const shownMinutes = visible.reduce((n, e) => n + e.durationMinutes, 0);
  const shownBillable = visible.reduce((n, e) => n + (e.isBillable ? e.durationMinutes : 0), 0);

  const customerOptions = (currentId?: string): ComboOption[] =>
    customers.filter((c) => c.isActive || c.id === currentId).map((c) => ({ id: c.id, label: c.name }));
  const jobOptions = (customerId: string, currentId?: string | null): ComboOption[] =>
    lookupJobs(customerId)
      .filter((j) => j.isActive || j.id === currentId)
      .map((j) => ({ id: j.id, label: j.name }));
  const serviceOptions: ComboOption[] = serviceItems.map((x) => ({
    id: x.id,
    label: x.name,
    hint: x.defaultBillable ? undefined : "non-billable",
  }));
  const locationOptions: ComboOption[] = LOCATIONS.map((l) => ({ id: l.id, label: l.label }));

  const lookupJobs = (customerId: string) => customers.find((c) => c.id === customerId)?.jobs ?? [];

  // ---- editing existing rows -------------------------------------------------
  const patchEntry = async (entry: TimeEntryItem, patch: Partial<TimeEntryItem>) => {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)));
    try {
      const res = await fetch(`/api/time-entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Update failed");
      // The server is the source of truth: editing an approved/exported row re-flags it for the accountant.
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? json.data : e)));
      if ((entry.status === "approved" || entry.status === "exported") && json.data.flagged) {
        onMessage({ type: "success", text: "Saved. Your accountant has been flagged to re-check this entry." });
      }
    } catch (err) {
      onMessage({ type: "error", text: err instanceof Error ? err.message : "Could not save change" });
      onChanged(); // roll back to server state
    }
  };

  const changeCustomer = (entry: TimeEntryItem, customerId: string) => {
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    patchEntry(entry, { customerId, customerName: c.name, jobId: null, jobName: null });
  };

  const changeJob = (entry: TimeEntryItem, jobId: string) => {
    const j = lookupJobs(entry.customerId).find((x) => x.id === jobId);
    patchEntry(entry, { jobId: j?.id ?? null, jobName: j?.name ?? null });
  };

  const changeService = (entry: TimeEntryItem, serviceId: string) => {
    const s = serviceItems.find((x) => x.id === serviceId);
    if (!s) return;
    patchEntry(entry, { serviceItemId: s.id, serviceItemName: s.name, isBillable: s.defaultBillable });
  };

  const commitHours = (entry: TimeEntryItem, raw: string) => {
    const min = parseDuration(raw);
    if (min === null || min <= 0) {
      onMessage({ type: "error", text: `"${raw}" isn't a valid duration. Try 1.5, 1:30 or 2h 15m.` });
      setEntries((prev) => [...prev]); // force the cell to snap back
      return;
    }
    if (min !== entry.durationMinutes) patchEntry(entry, { durationMinutes: min });
  };

  const deleteEntry = async (entry: TimeEntryItem) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
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
        userId: e.userId, customerId: e.customerId, jobId: e.jobId ?? null, serviceItemId: e.serviceItemId,
        date: e.date, durationMinutes: e.durationMinutes, locationType: e.locationType, locationName: e.locationName,
        latitude: e.latitude, longitude: e.longitude, notes: e.notes ?? "", isBillable: e.isBillable, status: e.status,
      }),
    });
    const json = await res.json().catch(() => null);
    if (json?.success) onChanged();
    else onMessage({ type: "error", text: "Couldn't restore that row." });
  };

  /** Copy a row's details into the entry row so a similar entry is one number away. */
  const copyToNewRow = (e: TimeEntryItem) => {
    setDraft({
      date: e.date,
      customerId: e.customerId,
      jobId: e.jobId ?? "",
      serviceItemId: e.serviceItemId,
      locationType: e.locationType,
      hours: "",
      isBillable: e.isBillable,
      notes: e.notes ?? "",
    });
    setTimeout(() => focusCell("new", "hours"), 0);
  };

  // ---- the entry row ---------------------------------------------------------
  const addEntry = async () => {
    // If a customer/project/task was just created, let it finish and render before validating.
    await creating.current;
    await new Promise((r) => setTimeout(r, 0));
    const { draft, customers, serviceItems } = latest.current;
    const min = parseDuration(draft.hours);
    if (min === null || min <= 0) {
      onMessage({ type: "error", text: "Enter a duration first (e.g. 1.5, 1:30 or 2h 15m)." });
      focusCell("new", "hours");
      return;
    }
    if (!customers.some((c) => c.id === draft.customerId) || !serviceItems.some((x) => x.id === draft.serviceItemId)) {
      onMessage({ type: "error", text: "Choose a customer and a task." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          customerId: draft.customerId,
          jobId: draft.jobId || null,
          serviceItemId: draft.serviceItemId,
          date: draft.date,
          durationMinutes: min,
          locationType: draft.locationType,
          notes: draft.notes,
          isBillable: draft.isBillable,
          status: "submitted",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to add entry");
      // Keep customer/job/service/date so repeat entries are just "hours + Enter".
      setDraft((d) => ({ ...d, hours: "", notes: "" }));
      onChanged();
      setTimeout(() => focusCell("new", "hours"), 0);
    } catch (err) {
      onMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to add entry" });
    } finally {
      setSaving(false);
    }
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
    const isSelect = false;
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
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isSelect && !isDate && !isCheckbox) {
      step = e.key === "ArrowDown" ? 1 : -1;
    } else return;

    e.preventDefault();
    if (row === "new") {
      if (step > 0 && visible.length) focusCell(visible[0].id, col);
      return;
    }
    const idx = visible.findIndex((v) => v.id === row);
    const next = idx + step;
    if (next < 0) focusCell("new", col);
    else if (next < visible.length) focusCell(visible[next].id, col);
  };

  const dayGroups = useMemo(() => {
    const totals = new Map<string, number>();
    visible.forEach((e) => totals.set(e.date, (totals.get(e.date) ?? 0) + e.durationMinutes));
    return totals;
  }, [visible]);

  const fmtDay = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      {/* Summary + search */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border/70 px-4 py-3">
        <Stat label="Today" value={stats.day} />
        <Stat label="This week" value={stats.week} />
        <Stat label="Billable" value={stats.billable} sub={stats.total ? `${Math.round((stats.billable / stats.total) * 100)}%` : undefined} />
        <Stat label="All logged" value={stats.total} />
        <WeekBars entries={entries} />
        <a
          href={`/api/export/csv?userId=${userId}`}
          download
          title="Download all of your time as a spreadsheet (CSV)"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground max-sm:ml-0"
        >
          <Download className="h-3.5 w-3.5" />Export CSV
        </a>
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
        <table className="stack-table w-full min-w-[70rem] border-separate border-spacing-0 text-left">
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
                <input
                  type="date"
                  aria-label="New entry date"
                  data-r="new"
                  data-c="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className={cellBase}
                />
              </td>
              <td data-label="Customer" className="span-2 max-md:order-3">
                <Combobox
                  aria-label="New entry customer"
                  data-r="new"
                  data-c="customer"
                  placeholder="Customer…"
                  value={draft.customerId}
                  options={customerOptions()}
                  onSelect={(id) => setDraft({ ...draft, customerId: id, jobId: "" })}
                  onCreate={async (name) => {
                    const id = await track(onCreateCustomer(name));
                    if (id) setDraft((d) => ({ ...d, customerId: id, jobId: "" }));
                  }}
                />
              </td>
              <td data-label="Project" className="max-md:order-4">
                <Combobox
                  aria-label="New entry job"
                  data-r="new"
                  data-c="job"
                  placeholder="Project…"
                  emptyLabel="— no project —"
                  value={draft.jobId}
                  options={jobOptions(draft.customerId)}
                  onSelect={(id) => setDraft({ ...draft, jobId: id })}
                  onCreate={
                    draft.customerId
                      ? async (name) => {
                          const id = await track(onCreateJob(draft.customerId, name));
                          if (id) setDraft((d) => ({ ...d, jobId: id }));
                        }
                      : undefined
                  }
                />
              </td>
              <td data-label="Task" className="max-md:order-5">
                <Combobox
                  aria-label="New entry task"
                  data-r="new"
                  data-c="service"
                  placeholder="Task…"
                  value={draft.serviceItemId}
                  options={serviceOptions}
                  onSelect={(id) => {
                    const x = serviceItems.find((i) => i.id === id);
                    setDraft({ ...draft, serviceItemId: id, isBillable: x?.defaultBillable ?? draft.isBillable });
                  }}
                  onCreate={async (name) => {
                    const id = await track(onCreateService(name));
                    if (id) setDraft((d) => ({ ...d, serviceItemId: id, isBillable: true }));
                  }}
                />
              </td>
              <td data-label="Location" className="max-md:order-6">
                <Combobox
                  aria-label="New entry location"
                  data-r="new"
                  data-c="location"
                  value={draft.locationType}
                  options={locationOptions}
                  onSelect={(id) => setDraft({ ...draft, locationType: id as LocationType })}
                />
              </td>
              <td data-label="Hours" className="max-md:order-2">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="New entry hours"
                  data-r="new"
                  data-c="hours"
                  placeholder="1.5 · 1:30 · 2h"
                  value={draft.hours}
                  onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
                  className={cn(cellBase, "text-right font-mono tabular-nums")}
                />
              </td>
              <td data-label="Billable" className="text-center max-md:text-left max-md:order-7">
                <input
                  type="checkbox"
                  aria-label="New entry billable"
                  data-r="new"
                  data-c="billable"
                  checked={draft.isBillable}
                  onChange={(e) => setDraft({ ...draft, isBillable: e.target.checked })}
                  className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]"
                />
              </td>
              <td data-label="Notes" className="span-2 max-md:order-8">
                <input
                  type="text"
                  aria-label="New entry notes"
                  data-r="new"
                  data-c="notes"
                  placeholder="Notes — press Enter to add"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  className={cellBase}
                />
              </td>
              <td data-label="Status" className="cell-hide-mobile px-2 text-[11px] font-medium text-primary max-md:order-9">New entry</td>
              <td className="text-center actions-cell max-md:order-10">
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={saving}
                  title="Add entry (Enter)"
                  aria-label="Add entry"
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />Add
                </button>
              </td>
            </tr>

            {visible.map((e, i) => {
              const locked = e.status === "approved" || e.status === "exported"; // can edit (flags accountant) but not delete
              const firstOfDay = i === 0 || visible[i - 1].date !== e.date;
              return (
                <RowGroup key={e.id}>
                  {firstOfDay && (
                    <tr className="group-row">
                      <td
                        colSpan={COLUMNS.length}
                        className="bg-surface-low px-2 py-1 text-[11px] font-semibold text-muted-foreground"
                      >
                        {fmtDay(e.date)}
                        <span className="ml-2 font-mono font-medium tabular-nums">
                          {fmtHours(dayGroups.get(e.date) ?? 0)}h
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr className={cn("group bg-card hover:bg-surface-low", e.flagged && "bg-destructive/[0.04]")}>
                    <td data-label="Date" className="max-md:order-1">
                      <TextCell
                        type="date"
                        aria-label="Date"
                        data-r={e.id}
                        data-c="date"
                                                value={e.date}
                        onCommit={(v) => v && patchEntry(e, { date: v })}
                      />
                    </td>
                    <td data-label="Customer" className="span-2 max-md:order-3">
                      <Combobox
                        aria-label="Customer"
                        data-r={e.id}
                        data-c="customer"
                                                value={e.customerId}
                        options={customerOptions(e.customerId)}
                        onSelect={(id) => changeCustomer(e, id)}
                        onCreate={async (name) => {
                          const id = await track(onCreateCustomer(name));
                          if (id) changeCustomer(e, id);
                        }}
                      />
                    </td>
                    <td data-label="Project" className="max-md:order-4">
                      <Combobox
                        aria-label="Job"
                        data-r={e.id}
                        data-c="job"
                                                placeholder="— no project —"
                        emptyLabel="— no project —"
                        value={e.jobId ?? ""}
                        options={jobOptions(e.customerId, e.jobId)}
                        onSelect={(id) => changeJob(e, id)}
                        onCreate={async (name) => {
                          const id = await track(onCreateJob(e.customerId, name));
                          if (id) changeJob(e, id);
                        }}
                      />
                    </td>
                    <td data-label="Task" className="max-md:order-5">
                      <Combobox
                        aria-label="Task"
                        data-r={e.id}
                        data-c="service"
                                                value={e.serviceItemId}
                        options={serviceOptions}
                        onSelect={(id) => changeService(e, id)}
                        onCreate={async (name) => {
                          const id = await track(onCreateService(name));
                          if (id) changeService(e, id);
                        }}
                      />
                    </td>
                    <td data-label="Location" className="max-md:order-6">
                      <Combobox
                        aria-label="Location"
                        data-r={e.id}
                        data-c="location"
                                                value={e.locationType}
                        options={locationOptions}
                        onSelect={(id) => patchEntry(e, { locationType: id as LocationType })}
                      />
                    </td>
                    <td data-label="Hours" className="max-md:order-2">
                      <TextCell
                        type="text"
                        inputMode="decimal"
                        aria-label="Hours"
                        data-r={e.id}
                        data-c="hours"
                                                value={fmtHours(e.durationMinutes)}
                        onCommit={(v) => commitHours(e, v)}
                        className="text-right font-mono tabular-nums"
                      />
                    </td>
                    <td data-label="Billable" className="text-center max-md:text-left max-md:order-7">
                      <input
                        type="checkbox"
                        aria-label="Billable"
                        data-r={e.id}
                        data-c="billable"
                                                checked={e.isBillable}
                        onChange={(ev) => patchEntry(e, { isBillable: ev.target.checked })}
                        className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))] disabled:cursor-not-allowed"
                      />
                    </td>
                    <td data-label="Notes" className="span-2 max-md:order-8">
                      <TextCell
                        type="text"
                        aria-label="Notes"
                        data-r={e.id}
                        data-c="notes"
                                                value={e.notes ?? ""}
                        onCommit={(v) => patchEntry(e, { notes: v })}
                      />
                    </td>
                    <td data-label="Status" className="px-2  max-md:order-9">
                      {e.flagged ? (
                        <span
                          title={e.flagReason ?? "Edited after approval — waiting for your accountant"}
                          className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                        >
                          <Flag className="h-3 w-3" />Flagged
                        </span>
                      ) : (
                        <span
                          title={locked ? "You can still edit this — your accountant will be flagged to re-check it." : undefined}
                          className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[e.status])}
                        >
                          {locked && <Lock className="h-3 w-3" />}
                          {e.status}
                        </span>
                      )}
                    </td>
                    <td className="px-1 actions-cell max-md:order-10">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => copyToNewRow(e)}
                          title="Copy details to the new-entry row"
                          aria-label="Copy row"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {locked ? (
                          <span title="Approved or exported rows can be edited but not deleted" className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground/40">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => deleteEntry(e)}
                            title="Delete row"
                            aria-label="Delete row"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          >
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
                  {entries.length === 0
                    ? "No time logged yet — fill in the blue row above and press Enter."
                    : "No rows match your filter."}
                </td>
              </tr>
            )}
          </tbody>

          <tfoot className="sticky bottom-0 z-10 max-md:static">
            <tr className="[&_td]:border-t [&_td]:border-border [&_td]:bg-surface-container">
              <td colSpan={5} className="span-2 h-9 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {query ? `${visible.length} of ${entries.length} rows` : `${entries.length} rows`} · {userName}
              </td>
              <td className="px-2 text-right font-mono text-[13px] font-semibold tabular-nums">{fmtHours(shownMinutes)}</td>
              <td colSpan={4} className="span-2 px-2 text-[11px] text-muted-foreground">
                {fmtHours(shownBillable)}h billable
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {undo && (
        <div role="status" className="absolute bottom-12 left-1/2 z-30 flex -translate-x-1/2 animate-m3-rise items-center gap-3 rounded-full bg-foreground py-2 pl-4 pr-2 text-xs font-medium text-background shadow-xl">
          <span>Deleted {fmtHours(undo.entry.durationMinutes)}h for {undo.entry.customerName}</span>
          <button onClick={undoDelete} className="inline-flex items-center gap-1 rounded-full bg-background/15 px-3 py-1 font-semibold transition hover:bg-background/25">
            <Undo2 className="h-3.5 w-3.5" />Undo
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
        <span><kbd className="font-mono font-semibold text-foreground">Tab</kbd> next cell</span>
        <span><kbd className="font-mono font-semibold text-foreground">Enter</kbd> / <kbd className="font-mono font-semibold text-foreground">↓</kbd> cell below</span>
        <span><kbd className="font-mono font-semibold text-foreground">Esc</kbd> undo edit</span>
        <span>Hours accept <span className="font-mono">1.5</span>, <span className="font-mono">1:30</span>, <span className="font-mono">2h 15m</span></span>
        <span>Everything autosaves · you can edit past entries — changing an approved one flags your accountant</span>
      </div>
    </section>
  );
}

/** Fragment wrapper so a day header and its row can share one key. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Mon–Sun mini chart for the current week; the dashed line marks an 8h day. */
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
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-outline-variant"
          style={{ bottom: `${(480 / scale) * 100}%` }}
        />
        {days.map((d) => (
          <div key={d.key} className="flex h-full w-4 flex-col items-center justify-end gap-0.5" title={`${d.key}: ${fmtHours(d.minutes)}h`}>
            <div
              className={cn(
                "w-full rounded-t-[3px] transition-all duration-500 ease-expressive",
                d.isToday ? "bg-primary" : d.minutes ? "bg-primary/45" : "bg-surface-high"
              )}
              style={{ height: `${Math.max(d.minutes ? 8 : 3, (d.minutes / scale) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {days.map((d) => (
          <span key={d.key} className={cn("w-4 text-center text-[9px] font-medium", d.isToday ? "text-primary" : "text-muted-foreground")}>
            {d.label}
          </span>
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
