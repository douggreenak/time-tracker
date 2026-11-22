"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Plus, Search, Trash2 } from "lucide-react";
import type { CustomerItem, ServiceItem, TimeEntryItem } from "@/db/mock-data";
import { cn } from "@/components/ui";

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
  { key: "service", label: "Service item", width: "w-[12rem]" },
  { key: "location", label: "Location", width: "w-[7.5rem]" },
  { key: "hours", label: "Hours", width: "w-[6.5rem]", numeric: true },
  { key: "billable", label: "Bill", width: "w-[3.5rem]", center: true },
  { key: "notes", label: "Notes", width: "min-w-[16rem]" },
  { key: "status", label: "Status", width: "w-[6.5rem]" },
  { key: "actions", label: "", width: "w-[2.5rem]" },
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

const cellBase =
  "block h-9 w-full bg-transparent px-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 " +
  "focus:bg-card focus:shadow-[inset_0_0_0_2px_hsl(var(--primary))] disabled:cursor-not-allowed disabled:text-muted-foreground";
const selectCell = cn(cellBase, "m3-select cursor-pointer appearance-none truncate pr-6 [background-position:right_0.4rem_center] [background-size:12px_12px]");

/** Text-like cell that keeps a local draft and commits on blur / Enter; Escape reverts. */
function TextCell({
  value,
  onCommit,
  className,
  disabled,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  disabled?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      {...rest}
      disabled={disabled}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(cellBase, className)}
    />
  );
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

  // Seed the entry row once reference data arrives (and if the chosen ones disappear).
  useEffect(() => {
    setDraft((d) => {
      const cust = customers.some((c) => c.id === d.customerId) ? d.customerId : customers[0]?.id ?? "";
      const srv = serviceItems.find((s) => s.id === d.serviceItemId) ?? serviceItems[0];
      if (cust === d.customerId && srv?.id === d.serviceItemId) return d;
      return { ...d, customerId: cust, serviceItemId: srv?.id ?? "", isBillable: srv?.defaultBillable ?? true };
    });
  }, [customers, serviceItems]);

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
    if (!confirm(`Delete ${fmtHours(entry.durationMinutes)}h for ${entry.customerName} on ${entry.date}?`)) return;
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    try {
      const res = await fetch(`/api/time-entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      onMessage({ type: "error", text: "Could not delete entry" });
      onChanged();
    }
  };

  // ---- the entry row ---------------------------------------------------------
  const addEntry = async () => {
    const min = parseDuration(draft.hours);
    if (min === null || min <= 0) {
      onMessage({ type: "error", text: "Enter a duration first (e.g. 1.5, 1:30 or 2h 15m)." });
      focusCell("new", "hours");
      return;
    }
    if (!draft.customerId || !draft.serviceItemId) {
      onMessage({ type: "error", text: "Choose a customer and a service item." });
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
    const isSelect = el instanceof HTMLSelectElement;
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
    <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
      {/* Summary + search */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border/70 px-4 py-3">
        <Stat label="Today" value={stats.day} />
        <Stat label="This week" value={stats.week} />
        <Stat label="Billable" value={stats.billable} sub={stats.total ? `${Math.round((stats.billable / stats.total) * 100)}%` : undefined} />
        <Stat label="All logged" value={stats.total} />
        <div className="relative ml-auto w-full sm:w-64">
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

      <div ref={gridRef} onKeyDown={onGridKeyDown} className="m3-scroll max-h-[34rem] overflow-auto">
        <table className="w-full min-w-[78rem] border-separate border-spacing-0 text-left">
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
              <td>
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
              <td>
                <select
                  aria-label="New entry customer"
                  data-r="new"
                  data-c="customer"
                  value={draft.customerId}
                  onChange={(e) => setDraft({ ...draft, customerId: e.target.value, jobId: "" })}
                  className={selectCell}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  aria-label="New entry job"
                  data-r="new"
                  data-c="job"
                  value={draft.jobId}
                  onChange={(e) => setDraft({ ...draft, jobId: e.target.value })}
                  className={selectCell}
                >
                  <option value="">— no job —</option>
                  {lookupJobs(draft.customerId).map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  aria-label="New entry service item"
                  data-r="new"
                  data-c="service"
                  value={draft.serviceItemId}
                  onChange={(e) => {
                    const s = serviceItems.find((x) => x.id === e.target.value);
                    setDraft({ ...draft, serviceItemId: e.target.value, isBillable: s?.defaultBillable ?? draft.isBillable });
                  }}
                  className={selectCell}
                >
                  {serviceItems.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  aria-label="New entry location"
                  data-r="new"
                  data-c="location"
                  value={draft.locationType}
                  onChange={(e) => setDraft({ ...draft, locationType: e.target.value as LocationType })}
                  className={selectCell}
                >
                  {LOCATIONS.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </td>
              <td>
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
              <td className="text-center">
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
              <td>
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
              <td className="px-2 text-[11px] font-medium text-primary">New row</td>
              <td className="text-center">
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={saving}
                  title="Add entry (Enter)"
                  aria-label="Add entry"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </td>
            </tr>

            {visible.map((e, i) => {
              const locked = e.status === "approved" || e.status === "exported";
              const firstOfDay = i === 0 || visible[i - 1].date !== e.date;
              return (
                <RowGroup key={e.id}>
                  {firstOfDay && (
                    <tr>
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
                  <tr className={cn("group bg-card hover:bg-surface-low", locked && "bg-surface-low/60")}>
                    <td>
                      <TextCell
                        type="date"
                        aria-label="Date"
                        data-r={e.id}
                        data-c="date"
                        disabled={locked}
                        value={e.date}
                        onCommit={(v) => v && patchEntry(e, { date: v })}
                      />
                    </td>
                    <td>
                      <select
                        aria-label="Customer"
                        data-r={e.id}
                        data-c="customer"
                        disabled={locked}
                        value={e.customerId}
                        onChange={(ev) => changeCustomer(e, ev.target.value)}
                        className={selectCell}
                      >
                        {!customers.some((c) => c.id === e.customerId) && (
                          <option value={e.customerId}>{e.customerName}</option>
                        )}
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label="Job"
                        data-r={e.id}
                        data-c="job"
                        disabled={locked}
                        value={e.jobId ?? ""}
                        onChange={(ev) => changeJob(e, ev.target.value)}
                        className={selectCell}
                      >
                        <option value="">— no job —</option>
                        {lookupJobs(e.customerId).map((j) => (
                          <option key={j.id} value={j.id}>{j.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label="Service item"
                        data-r={e.id}
                        data-c="service"
                        disabled={locked}
                        value={e.serviceItemId}
                        onChange={(ev) => changeService(e, ev.target.value)}
                        className={selectCell}
                      >
                        {serviceItems.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label="Location"
                        data-r={e.id}
                        data-c="location"
                        disabled={locked}
                        value={e.locationType}
                        onChange={(ev) => patchEntry(e, { locationType: ev.target.value as LocationType })}
                        className={selectCell}
                      >
                        {LOCATIONS.map((l) => (
                          <option key={l.id} value={l.id}>{l.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <TextCell
                        type="text"
                        inputMode="decimal"
                        aria-label="Hours"
                        data-r={e.id}
                        data-c="hours"
                        disabled={locked}
                        value={fmtHours(e.durationMinutes)}
                        onCommit={(v) => commitHours(e, v)}
                        className="text-right font-mono tabular-nums"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        aria-label="Billable"
                        data-r={e.id}
                        data-c="billable"
                        disabled={locked}
                        checked={e.isBillable}
                        onChange={(ev) => patchEntry(e, { isBillable: ev.target.checked })}
                        className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))] disabled:cursor-not-allowed"
                      />
                    </td>
                    <td>
                      <TextCell
                        type="text"
                        aria-label="Notes"
                        data-r={e.id}
                        data-c="notes"
                        disabled={locked}
                        value={e.notes ?? ""}
                        onCommit={(v) => patchEntry(e, { notes: v })}
                      />
                    </td>
                    <td className="px-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          STATUS_STYLE[e.status]
                        )}
                      >
                        {locked && <Lock className="h-3 w-3" />}
                        {e.status}
                      </span>
                    </td>
                    <td className="text-center">
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => deleteEntry(e)}
                          title="Delete row"
                          aria-label="Delete row"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                </RowGroup>
              );
            })}

            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="py-10 text-center text-xs text-muted-foreground">
                  {entries.length === 0
                    ? "No time logged yet — fill in the blue row above and press Enter."
                    : "No rows match your filter."}
                </td>
              </tr>
            )}
          </tbody>

          <tfoot className="sticky bottom-0 z-10">
            <tr className="[&_td]:border-t [&_td]:border-border [&_td]:bg-surface-container">
              <td colSpan={5} className="h-9 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {query ? `${visible.length} of ${entries.length} rows` : `${entries.length} rows`} · {userName}
              </td>
              <td className="px-2 text-right font-mono text-[13px] font-semibold tabular-nums">{fmtHours(shownMinutes)}</td>
              <td colSpan={4} className="px-2 text-[11px] text-muted-foreground">
                {fmtHours(shownBillable)}h billable
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
        <span><kbd className="font-mono font-semibold text-foreground">Tab</kbd> next cell</span>
        <span><kbd className="font-mono font-semibold text-foreground">Enter</kbd> / <kbd className="font-mono font-semibold text-foreground">↓</kbd> cell below</span>
        <span><kbd className="font-mono font-semibold text-foreground">Esc</kbd> undo edit</span>
        <span>Hours accept <span className="font-mono">1.5</span>, <span className="font-mono">1:30</span>, <span className="font-mono">2h 15m</span></span>
        <span>Edits save as you go · approved / exported rows are locked</span>
      </div>
    </section>
  );
}

/** Fragment wrapper so a day header and its row can share one key. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
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
