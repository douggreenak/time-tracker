"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download, Flag, FoldVertical, Lock, Plus, Search, Send, SlidersHorizontal, Trash2, Undo2, UnfoldVertical } from "lucide-react";
import { FilterPanel } from "@/components/FilterPanel";
import { type EntryFilters, NO_FILTERS, activeFilterCount, matchesFilters } from "@/lib/filters";
import type { CustomerItem, ServiceItem, TimeEntryItem } from "@/db/mock-data";
import { cn } from "@/components/ui";
import { weekRangeLabel, weekStart, weekTag as weekTagOf } from "@/lib/weeks";
import { ExcelExport } from "@/components/ExcelExport";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { cellBase, TextCell } from "@/components/ui/cell";

type LocationType = TimeEntryItem["locationType"];
type Status = TimeEntryItem["status"];

const LOCATIONS: { id: LocationType; label: string }[] = [
  { id: "on_site", label: "On-site" },
  { id: "office", label: "Office" },
];

const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-surface-high text-muted-foreground",
  submitted: "bg-primary-container text-primary-on-container",
  approved: "bg-tertiary-container text-tertiary-on-container",
  exported: "bg-secondary-container text-secondary-on-container",
};

const COLUMNS = [
  { key: "date", label: "Date", width: "w-[10.75rem]" },
  { key: "customer", label: "Customer", width: "w-[13rem]" },
  { key: "job", label: "Job", width: "w-[11rem]" },
  { key: "service", label: "Task", width: "w-[12rem]" },
  { key: "location", label: "Location", width: "w-[7.5rem]" },
  { key: "hours", label: "Hours", width: "w-[6.5rem]", numeric: true },
  { key: "billable", label: "Billable", width: "w-[5rem]", center: true },
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
  const [filters, setFilters] = useState<EntryFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = activeFilterCount(filters);
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

  // Rows added a moment ago are shown at once and saved in the background; until saved they carry a temporary id.
  const PENDING = "pending-";
  const pendingEdits = useRef(new Map<string, Partial<TimeEntryItem>>());
  const cancelled = useRef(new Set<string>());

  const draftKey = `tt-draft-v1:${userId}`;
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [flagOpen, setFlagOpen] = useState<TimeEntryItem | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
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

  // If a chosen customer/project/task has since been removed, clear it (all three are optional).
  useEffect(() => {
    if (!draftLoaded) return;
    setDraft((d) => {
      const cust = customers.find((c) => c.id === d.customerId);
      const customerId = cust ? d.customerId : "";
      const jobId = cust?.jobs.some((j) => j.id === d.jobId) ? d.jobId : "";
      const serviceItemId = serviceItems.some((x) => x.id === d.serviceItemId) ? d.serviceItemId : "";
      if (customerId === d.customerId && jobId === d.jobId && serviceItemId === d.serviceItemId) return d;
      return { ...d, customerId, jobId, serviceItemId };
    });
  }, [customers, serviceItems, draftLoaded]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [entries]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = filterCount ? sorted.filter((e) => matchesFilters(e, filters)) : sorted;
    if (!q) return base;
    return base.filter((e) =>
      [e.date, e.customerName, e.jobName, e.serviceItemName, e.notes, e.locationType, e.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [sorted, query, filters, filterCount]);

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
  // Older rows may still say Remote/Travel: keep showing them, but they're no longer offered for new choices.
  const locationOptions = (current?: string): ComboOption[] => [
    ...LOCATIONS.map((l) => ({ id: l.id, label: l.label })),
    ...(current && !LOCATIONS.some((l) => l.id === current) ? [{ id: current, label: current === "travel" ? "Travel" : current === "remote" ? "Remote" : current }] : []),
  ];

  const lookupJobs = (customerId: string) => customers.find((c) => c.id === customerId)?.jobs ?? [];

  // ---- editing existing rows -------------------------------------------------
  const patchEntry = async (entry: TimeEntryItem, patch: Partial<TimeEntryItem>) => {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)));
    if (entry.id.startsWith(PENDING)) {
      // Still being created in the background: remember the edit and send it once the row exists.
      pendingEdits.current.set(entry.id, { ...pendingEdits.current.get(entry.id), ...patch });
      return;
    }
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
    patchEntry(entry, { customerId: c?.id ?? "", customerName: c?.name ?? "", jobId: null, jobName: null });
  };

  const changeJob = (entry: TimeEntryItem, jobId: string) => {
    const j = lookupJobs(entry.customerId).find((x) => x.id === jobId);
    patchEntry(entry, { jobId: j?.id ?? null, jobName: j?.name ?? null });
  };

  const changeService = (entry: TimeEntryItem, serviceId: string) => {
    const s = serviceItems.find((x) => x.id === serviceId);
    if (!s) return patchEntry(entry, { serviceItemId: "", serviceItemName: "" }); // task is optional
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
    if (entry.id.startsWith(PENDING)) {
      cancelled.current.add(entry.id); // removed again as soon as it finishes saving
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

  // ---- submitting time (selected rows, or a whole week) --------------------------------
  const draftIdsInView = useMemo(() => new Set(entries.filter((e) => e.status === "draft").map((e) => e.id)), [entries]);
  const pickedDrafts = Array.from(picked).filter((id) => draftIdsInView.has(id));
  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const submitEntries = async (ids: string[], what: string) => {
    const real = ids.filter((id) => !id.startsWith(PENDING));
    if (!real.length) return;
    // Mark them submitted right away; put back any that fail.
    const idSet = new Set(real);
    setEntries((prev) => prev.map((e) => (idSet.has(e.id) ? { ...e, status: "submitted" } : e)));
    setPicked(new Set());
    const results = await Promise.all(
      real.map((id) =>
        fetch(`/api/time-entries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "submitted" }) })
          .then((r) => r.json())
          .then((j) => (j.success ? (j.data as TimeEntryItem) : null))
          .catch(() => null)
      )
    );
    const done = results.filter((x): x is TimeEntryItem => !!x);
    const failedIds = new Set(real.filter((id) => !done.some((d) => d.id === id)));
    setEntries((prev) => prev.map((e) => done.find((d) => d.id === e.id) ?? (failedIds.has(e.id) ? { ...e, status: "draft" } : e)));
    onMessage(
      failedIds.size
        ? { type: "error", text: `${failedIds.size} of ${real.length} couldn't be submitted. Try again.` }
        : { type: "success", text: `Submitted ${what} to your accountant (${done.length} ${done.length === 1 ? "entry" : "entries"}).` }
    );
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
    const cust = customers.find((c) => c.id === draft.customerId);
    const customerId = cust?.id ?? "";
    const jobId = cust?.jobs.some((j) => j.id === draft.jobId) ? draft.jobId : "";
    const serviceItemId = serviceItems.some((x) => x.id === draft.serviceItemId) ? draft.serviceItemId : "";
    // Show the row immediately and clear the entry row so the next one can be typed right away;
    // the save happens in the background and the row is swapped for the saved copy when it finishes.
    const job = cust?.jobs.find((j) => j.id === jobId);
    const svc = serviceItems.find((x) => x.id === serviceItemId);
    const tempId = `${PENDING}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp: TimeEntryItem = {
      id: tempId,
      userId,
      userName,
      customerId,
      customerName: cust?.name ?? "",
      jobId: jobId || undefined,
      jobName: job?.name ?? undefined,
      serviceItemId,
      serviceItemName: svc?.name ?? "",
      date: draft.date,
      durationMinutes: min,
      locationType: draft.locationType,
      notes: draft.notes,
      isBillable: draft.isBillable,
      status: "draft",
      flagged: false,
      createdAt: new Date().toISOString(),
    } as TimeEntryItem;
    const keep = { hours: draft.hours, notes: draft.notes };
    setEntries((prev) => [temp, ...prev]);
    setWeekOpen(weekStart(draft.date), true);
    setDraft((d) => ({ ...d, hours: "", notes: "" }));
    setTimeout(() => focusCell("new", "hours"), 0);

    const drop = () => setEntries((prev) => prev.filter((e) => e.id !== tempId));
    (async () => {
      try {
        const res = await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            customerId,
            jobId: jobId || null,
            serviceItemId,
            date: draft.date,
            durationMinutes: min,
            locationType: draft.locationType,
            notes: draft.notes,
            isBillable: draft.isBillable,
            status: "draft",
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
        // Give the typed values back so nothing is lost.
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
      if (step > 0 && rendered.length) focusCell(rendered[0].id, col);
      return;
    }
    const idx = rendered.findIndex((v) => v.id === row);
    const next = idx + step;
    if (next < 0) focusCell("new", col);
    else if (next < rendered.length) focusCell(rendered[next].id, col);
  };

  // ---- collapsible weeks (pay is weekly) -----------------------------------------
  const thisWeek = weekStart(today());
  const [weekOverride, setWeekOverrideState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setWeekOverrideState(JSON.parse(localStorage.getItem("tt-weeks-v1") ?? "{}"));
    } catch {}
  }, []);
  const setWeekOpen = (wk: string, open: boolean) =>
    setWeekOverrideState((prev) => {
      const next = { ...prev, [wk]: open };
      try {
        localStorage.setItem("tt-weeks-v1", JSON.stringify(next));
      } catch {}
      return next;
    });
  /** The current week starts open and older weeks start closed; filtering opens everything that matches. */
  const isWeekOpen = (wk: string) => (query.trim() || filterCount ? true : weekOverride[wk] ?? wk === thisWeek);

  const weeks = useMemo(() => {
    const m = new Map<string, { minutes: number; billable: number; count: number; approved: number; exported: number; submitted: number; draft: number; draftIds: string[]; flagged: number }>();
    visible.forEach((e) => {
      const wk = weekStart(e.date);
      const w = m.get(wk) ?? { minutes: 0, billable: 0, count: 0, approved: 0, exported: 0, submitted: 0, draft: 0, draftIds: [], flagged: 0 };
      w.minutes += e.durationMinutes;
      if (e.isBillable) w.billable += e.durationMinutes;
      w.count += 1;
      if (e.status === "approved") w.approved += 1;
      else if (e.status === "exported") w.exported += 1;
      else if (e.status === "draft") { w.draft += 1; w.draftIds.push(e.id); }
      else w.submitted += 1;
      if (e.flagged) w.flagged += 1;
      m.set(wk, w);
    });
    return m;
  }, [visible]);

  const weekLabel = weekRangeLabel;
  const weekTag = weekTagOf;
  const allWeeks = Array.from(weeks.keys());
  const anyClosed = allWeeks.some((w) => !isWeekOpen(w));
  const setAllWeeks = (open: boolean) =>
    setWeekOverrideState(() => {
      const next = Object.fromEntries(allWeeks.map((w) => [w, open]));
      try {
        localStorage.setItem("tt-weeks-v1", JSON.stringify(next));
      } catch {}
      return next;
    });

  // Rows you can actually see (rows in a collapsed week are hidden); arrow-key navigation uses these.
  const rendered = useMemo(() => visible.filter((e) => isWeekOpen(weekStart(e.date))), [visible, weekOverride, query, filterCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayGroups = useMemo(() => {
    const totals = new Map<string, number>();
    visible.forEach((e) => totals.set(e.date, (totals.get(e.date) ?? 0) + e.durationMinutes));
    return totals;
  }, [visible]);

  const fmtDay = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
      {/* Summary + search */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border/70 px-4 py-3">
        <Stat label="Today" value={stats.day} />
        <Stat label="This week" value={stats.week} />
        <Stat label="Billable" value={stats.billable} sub={stats.total ? `${Math.round((stats.billable / stats.total) * 100)}%` : undefined} />
        <Stat label="All logged" value={stats.total} />
        <WeekBars entries={entries} />
        <div className="ml-auto flex flex-wrap items-center gap-2 max-sm:ml-0">
        {draftIdsInView.size > 0 && (
          <button
            type="button"
            onClick={() => setPicked(pickedDrafts.length === draftIdsInView.size ? new Set() : new Set(draftIdsInView))}
            data-testid="select-drafts"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
          >
            {pickedDrafts.length === draftIdsInView.size ? "Clear selection" : `Select drafts (${draftIdsInView.size})`}
          </button>
        )}
        {pickedDrafts.length > 0 && (
          <button
            type="button"
            onClick={() => submitEntries(pickedDrafts, "the selected time")}
            data-testid="submit-selected"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />Submit selected ({pickedDrafts.length})
          </button>
        )}
        <ExcelExport userId={userId} weeks={Array.from(new Set(entries.map((e) => weekStart(e.date))))} />
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
          title="Download all of your time as a spreadsheet (CSV)"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />Export CSV
        </a>
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          data-testid="filters-toggle"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
            filtersOpen || filterCount ? "border-primary/40 bg-primary/10 text-primary" : "border-outline-variant text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />Filters{filterCount > 0 && ` (${filterCount})`}
        </button>
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

      {filtersOpen && (
        <div className="border-b border-border/70 bg-surface-low px-4 py-3">
          <FilterPanel entries={entries} value={filters} onChange={setFilters} fields={["customer", "project", "task", "status", "billable", "location", "from", "to"]} label="Timesheet filters" />
        </div>
      )}

      <div ref={gridRef} onKeyDown={onGridKeyDown} className={cn("stack-table-wrap m3-scroll min-h-[16rem] overflow-auto", filtersOpen ? "h-[calc(100dvh-29rem)]" : "h-[calc(100dvh-21.5rem)]")}>
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
                  placeholder="Customer (optional)…"
                  emptyLabel="— no customer —"
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
                  placeholder="Task (optional)…"
                  emptyLabel="— no task —"
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
                  options={locationOptions()}
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
                  placeholder="Notes"
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
              const wk = weekStart(e.date);
              const firstOfWeek = i === 0 || weekStart(visible[i - 1].date) !== wk;
              const weekOpen = isWeekOpen(wk);
              const firstOfDay = i === 0 || visible[i - 1].date !== e.date || firstOfWeek;
              const w = weeks.get(wk)!;
              const weekHeader = firstOfWeek && (
                <tr className="group-row week-row" data-week={wk}>
                  <td colSpan={COLUMNS.length} className="border-y border-border border-l-4 border-l-primary bg-primary/[0.13] p-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-2 max-md:flex-col max-md:items-stretch">
                      <button
                        type="button"
                        onClick={() => setWeekOpen(wk, !weekOpen)}
                        aria-expanded={weekOpen}
                        aria-label={`${weekOpen ? "Collapse" : "Expand"} week of ${weekLabel(wk)}`}
                        data-testid="week-toggle"
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
                      >
                        {weekOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="text-[13px] font-semibold">{weekLabel(wk)}</span>
                        {weekTag(wk) && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{weekTag(wk)}</span>}
                        <span className="font-mono text-[13px] font-semibold tabular-nums" data-testid="week-hours">{fmtHours(w.minutes)} h</span>
                        <span className="text-[11px] text-muted-foreground">{fmtHours(w.billable)} h billable · {w.count} {w.count === 1 ? "entry" : "entries"}</span>
                        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                          {w.flagged > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">{w.flagged} flagged</span>}
                          {w.draft > 0 && <span className="rounded-full bg-surface-high px-2 py-0.5 text-muted-foreground">{w.draft} draft</span>}
                          {w.submitted > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{w.submitted} submitted</span>}
                          {w.approved > 0 && <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-tertiary-on-container">{w.approved} approved</span>}
                          {w.exported > 0 && <span className="rounded-full bg-surface-high px-2 py-0.5 text-muted-foreground">{w.exported} exported</span>}
                        </span>
                      </button>
                      {w.draft > 0 && (
                        <button
                          type="button"
                          onClick={() => submitEntries(w.draftIds, `the week of ${weekLabel(wk)}`)}
                          data-testid="submit-week"
                          aria-label={`Submit week of ${weekLabel(wk)}`}
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 max-md:mx-3 max-md:mb-2 max-md:justify-center"
                        >
                          <Send className="h-3.5 w-3.5" />Submit week ({w.draft})
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              if (!weekOpen) return firstOfWeek ? <RowGroup key={`wk-${wk}`}>{weekHeader}</RowGroup> : null;
              return (
                <RowGroup key={e.id}>
                  {weekHeader}
                  {firstOfDay && (
                    <tr className="group-row day-row">
                      <td
                        colSpan={COLUMNS.length}
                        className="border-l-[3px] border-l-primary/50 bg-primary/[0.055] py-1.5 pl-7 pr-2 text-[11px] font-semibold text-foreground/70"
                      >
                        {fmtDay(e.date)}
                        <span className="ml-2 font-mono font-medium tabular-nums">
                          {fmtHours(dayGroups.get(e.date) ?? 0)}h
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr className={cn("entry-row group bg-card hover:bg-surface-low", e.flagged && "bg-destructive/[0.04]", e.id.startsWith(PENDING) && "opacity-70")}>
                    <td data-label="Date" className="border-l-[3px] border-l-primary/15 pl-4 max-md:order-1">
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
                        onCreate={
                          e.customerId
                            ? async (name) => {
                                const id = await track(onCreateJob(e.customerId, name));
                                if (id) changeJob(e, id);
                              }
                            : undefined
                        }
                      />
                    </td>
                    <td data-label="Task" className="max-md:order-5">
                      <Combobox
                        aria-label="Task"
                        data-r={e.id}
                        data-c="service"
                        placeholder="— no task —"
                        emptyLabel="— no task —"
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
                        options={locationOptions(e.locationType)}
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
                      <div className="flex flex-wrap items-center gap-1">
                        {(e.flagged || (e.flagHistory?.length ?? 0) > 0) && (
                          <button
                            type="button"
                            onClick={() => setFlagOpen(e)}
                            title={e.flagged ? "Click to read the message" : "Resolved — click to see the notes"}
                            aria-label={e.flagged ? `Flagged — read the message for ${e.date}` : `Flag history for ${e.date}`}
                            data-testid={e.flagged ? "flag-badge" : "flag-badge-resolved"}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition",
                              e.flagged ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-muted text-muted-foreground hover:bg-foreground/10"
                            )}
                          >
                            <Flag className="h-3 w-3" />Flagged
                          </button>
                        )}
                        {!e.flagged && (
                          <span
                            title={locked ? "You can still edit this — your accountant will be flagged to re-check it." : undefined}
                            className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[e.status])}
                          >
                            {locked && <Lock className="h-3 w-3" />}
                            {e.status}
                          </span>
                        )}
                      </div>
                      {e.status === "draft" && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${e.date} entry to submit`}
                          checked={picked.has(e.id)}
                          onChange={() => togglePick(e.id)}
                          className="ml-2 h-4 w-4 cursor-pointer align-middle accent-[hsl(var(--primary))]"
                          title="Select to submit"
                        />
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
                Total
              </td>
              <td className="px-2 text-right font-mono text-[13px] font-semibold tabular-nums">{fmtHours(shownMinutes)}</td>
              <td colSpan={4} className="span-2 px-2 text-[11px] text-muted-foreground">
                {fmtHours(shownBillable)}h billable
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {flagOpen && (() => {
        const fe = entries.find((x) => x.id === flagOpen.id) ?? flagOpen;
        const asks = (fe.flagReason ?? "").startsWith("Accountant asks:");
        const text = (fe.flagReason ?? "").replace(/^Accountant asks:\s*/, "") || "This entry was edited after it was approved, so your accountant has been asked to check it again.";
        const history = [...(fe.flagHistory ?? [])].reverse();
        const KIND: Record<string, string> = { question: "Question", edit: "Edited", withdrawn: "Withdrawn", cleared: "Resolved" };
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setFlagOpen(null)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Message about this entry"
              onClick={(ev) => ev.stopPropagation()}
              onKeyDown={(ev) => ev.key === "Escape" && setFlagOpen(null)}
              className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", fe.flagged ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}><Flag className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{!fe.flagged ? "Resolved — flag history" : asks ? "Your accountant has a question" : "Flagged for your accountant"}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDay(fe.date)} · {fmtHours(fe.durationMinutes)} h{fe.customerName ? ` · ${fe.customerName}` : ""}{fe.jobName ? ` · ${fe.jobName}` : ""}{fe.serviceItemName ? ` · ${fe.serviceItemName}` : ""}
                  </p>
                </div>
              </div>
              {fe.flagged && (
                <>
                  <p data-testid="flag-message" className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-surface-low px-3 py-2.5 text-sm">{text}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {asks ? "Fix the entry if needed (hours, notes, customer…). The flag clears when your accountant approves it again or withdraws the question." : "The flag clears when your accountant approves it again."}
                  </p>
                </>
              )}
              {history.length > 0 && (
                <div className="mt-4">
                  <h4 className="m3-label">All notes</h4>
                  <ul data-testid="flag-history" className="mt-2 space-y-2">
                    {history.map((h, i) => (
                      <li key={i} className="rounded-xl border border-border/70 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{KIND[h.kind] ?? h.kind} · {h.by}</span>
                          <span>{new Date(h.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{h.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button autoFocus onClick={() => setFlagOpen(null)} className="h-9 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition hover:brightness-110">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

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
