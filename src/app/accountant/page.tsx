"use client";

import { flushSync } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronRight, BadgeCheck, CheckCheck, CheckCircle2, Download, FileSpreadsheet, Flag, Printer, RotateCcw, Search, Send, Undo2, X,
} from "lucide-react";
import type { CustomerItem, TimeEntryItem, UserItem } from "@/db/mock-data";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/components/ui";
import { PageLoader } from "@/components/ui/loader";
import { Dropdown } from "@/components/ui/dropdown";
import { FilterPanel } from "@/components/FilterPanel";
import { type EntryFilters, NO_FILTERS, locationLabel, matchesFilters } from "@/lib/filters";
import { PersonTimeReport, ProjectReport } from "@/components/Reports";
import { ExcelExport } from "@/components/ExcelExport";
import { weekRangeLabel, weekStart, weekTag } from "@/lib/weeks";

type Period = "today" | "this_week" | "last_week" | "this_month" | "last_month" | "quarter" | "ytd" | "all" | "custom";
type StatusFilter = "all" | "review" | "approved" | "exported" | "flagged";
type View = "entries" | "weeks" | "people" | "customers" | "projects" | "grid";
type Issue = "edited" | "missing" | "long_day" | "weekend" | "no_notes" | "duplicate" | "future";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "quarter", label: "Quarter" },
  { id: "ytd", label: "Year to date" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

const ISSUES: Record<Issue, { label: string; short: string; help: string; tone: string }> = {
  missing: { label: "No customer or task", short: "Incomplete", help: "QuickBooks needs a customer and a task on every time entry, so these are left out of the QuickBooks .iif file until the engineer fills them in. Your spreadsheet (CSV) export still includes them.", tone: "bg-destructive/10 text-destructive" },
  edited: { label: "Edited after approval", short: "Edited", help: "The engineer changed an entry you had already approved or exported — check it again (and re-export if it was already in QuickBooks).", tone: "bg-destructive/10 text-destructive" },
  long_day: { label: "Over 12 hours in a day", short: ">12h day", help: "One person logged more than 12 hours on the same date — often a typo.", tone: "bg-warning-container text-foreground" },
  weekend: { label: "Weekend work", short: "Weekend", help: "Time logged on a Saturday or Sunday — confirm it's real, and whether overtime applies.", tone: "bg-secondary-container text-secondary-on-container" },
  no_notes: { label: "Billable, no description", short: "No notes", help: "Billable time with no description is hard to defend on an invoice.", tone: "bg-secondary-container text-secondary-on-container" },
  duplicate: { label: "Possible duplicate", short: "Duplicate?", help: "Same person, date, customer, project, task and hours appear more than once.", tone: "bg-warning-container text-foreground" },
  future: { label: "Future date", short: "Future", help: "Dated after today.", tone: "bg-warning-container text-foreground" },
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-surface-high text-muted-foreground",
  submitted: "bg-primary-container text-primary-on-container",
  approved: "bg-tertiary-container text-tertiary-on-container",
  exported: "bg-secondary-container text-secondary-on-container",
};

const iso = (d: Date) => d.toLocaleDateString("en-CA");
const hrs = (m: number) => (m / 60).toFixed(2);
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function range(p: Period, from: string, to: string): [string | null, string | null] {
  const now = new Date();
  const day = now.getDay(); // weeks run Sunday–Saturday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const add = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  switch (p) {
    case "today": return [iso(now), iso(now)];
    case "this_week": return [iso(monday), iso(add(monday, 6))];
    case "last_week": return [iso(add(monday, -7)), iso(add(monday, -1))];
    case "this_month": return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
    case "last_month": return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))];
    case "quarter": { const q = Math.floor(now.getMonth() / 3) * 3; return [iso(new Date(now.getFullYear(), q, 1)), iso(new Date(now.getFullYear(), q + 3, 0))]; }
    case "ytd": return [iso(new Date(now.getFullYear(), 0, 1)), iso(now)];
    case "custom": return [from || null, to || null];
    default: return [null, null];
  }
}

/** What comes out of the printer: a plain, paginated report instead of a copy of the screen. */
function PrintSheet({ entries, title, filters, showValue, rate }: { entries: TimeEntryItem[]; title: string; filters: string[]; showValue: boolean; rate: Map<string, number> }) {
  const total = entries.reduce((s, e) => s + e.durationMinutes, 0);
  const billable = entries.filter((e) => e.isBillable).reduce((s, e) => s + e.durationMinutes, 0);
  const value = entries.filter((e) => e.isBillable).reduce((s, e) => s + (e.durationMinutes / 60) * (rate.get(e.userId) ?? 0), 0);
  const byPerson = Array.from(
    entries.reduce((m, e) => m.set(e.userName, (m.get(e.userName) ?? 0) + e.durationMinutes), new Map<string, number>())
  ).sort((a, b) => a[0].localeCompare(b[0]));
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName));
  return (
    <div data-testid="print-sheet" className="print-sheet hidden print:block">
      <h1 style={{ fontSize: "20pt", fontWeight: 700, margin: 0 }}>{title}</h1>
      <p style={{ margin: "4pt 0 0", fontSize: "10pt", color: "#444" }}>
        Printed {new Date().toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })} · {filters.length ? `Filters: ${filters.join(", ")}` : "All time, everyone"}
      </p>
      <table className="print-summary">
        <tbody>
          <tr><td>Entries</td><td>{entries.length}</td><td>Total hours</td><td>{hrs(total)}</td><td>Billable hours</td><td>{hrs(billable)}</td>{showValue && <><td>Billable value</td><td>{money(value)}</td></>}</tr>
        </tbody>
      </table>
      {byPerson.length > 0 && (
        <>
          <h2>Hours by person</h2>
          <table className="print-table">
            <thead><tr><th>Person</th><th className="num">Hours</th></tr></thead>
            <tbody>{byPerson.map(([n, m]) => <tr key={n}><td>{n}</td><td className="num">{hrs(m)}</td></tr>)}</tbody>
          </table>
        </>
      )}
      <h2>Entries</h2>
      <table className="print-table">
        <thead>
          <tr><th>Date</th><th>Person</th><th>Customer · project</th><th>Task</th><th>Notes</th><th className="num">Hours</th><th>Status</th></tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id}>
              <td>{e.date}</td><td>{e.userName}</td>
              <td>{e.customerName || "—"}{e.jobName ? ` · ${e.jobName}` : ""}</td>
              <td>{e.serviceItemName || "—"}</td>
              <td>{e.notes}</td>
              <td className="num">{hrs(e.durationMinutes)}{e.isBillable ? "" : " (nb)"}</td>
              <td style={{ textTransform: "capitalize" }}>{e.status}</td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "12pt" }}>No time matches these filters.</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={5}>Total</td><td className="num">{hrs(total)}</td><td /></tr></tfoot>
      </table>
    </div>
  );
}

function AccountantPage() {
  // Everyone can open this page. Engineers see only their own time (the page opens on them), can't approve it,
  // and don't see pay rates / dollar values.
  const { user: me, isManager } = useAuth();
  const isOwn = (e: { userId: string }) => !isManager && e.userId === me?.id;
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);

  const [period, setPeriod] = useState<Period>("all");
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 864e5)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [extra, setExtra] = useState<EntryFilters>(NO_FILTERS);
  const [personPick, setPerson] = useState("all");
  const person = isManager ? personPick : me?.id ?? "none";
  const [customer, setCustomer] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [issueFilter, setIssueFilter] = useState<Issue | "any" | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("entries");
  const [weekOpen, setWeekOpen] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [draftCount, setDraftCount] = useState(0);
  const [xlPerson, setXlPerson] = useState("");
  // The printable report only exists while the browser is printing (beforeprint → render it, afterprint → drop it).
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);

  const load = useCallback(async () => {
    try {
      const [c, u, e] = await Promise.all([
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/time-entries").then((r) => r.json()),
      ]);
      if (c.success) setCustomers(c.data);
      if (u.success) setUsers(u.data);
      if (e.success) {
        // Time the engineer hasn't submitted yet isn't ready for review.
        // (Accountants and admins approve their own time too, so their own drafts are reviewable.)
        const all = e.data as TimeEntryItem[];
        const reviewable = (x: TimeEntryItem) => x.status !== "draft" || (isManager && x.userId === me?.id);
        setEntries(all.filter(reviewable));
        setDraftCount(all.filter((x) => !reviewable(x)).length);
      }
    } finally {
      setLoading(false);
    }
  }, [isManager, me?.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  const rate = useMemo(() => new Map(users.map((u) => [u.id, u.defaultHourlyRate])), [users]);

  // ── automatic exception checks (use ALL entries so a person's whole day is considered) ──
  const rawIssues = useMemo(() => {
    const today = iso(new Date());
    const dayTotals = new Map<string, number>();
    const dupes = new Map<string, number>();
    for (const e of entries) {
      dayTotals.set(`${e.userId}|${e.date}`, (dayTotals.get(`${e.userId}|${e.date}`) ?? 0) + e.durationMinutes);
      const k = [e.userId, e.date, e.customerId, e.jobId ?? "", e.serviceItemId, e.durationMinutes].join("|");
      dupes.set(k, (dupes.get(k) ?? 0) + 1);
    }
    const out = new Map<string, Issue[]>();
    for (const e of entries) {
      const list: Issue[] = [];
      if (e.flagged) list.push("edited");
      if (!e.customerId || !e.serviceItemId) list.push("missing");
      if ((dayTotals.get(`${e.userId}|${e.date}`) ?? 0) > 12 * 60) list.push("long_day");
      const dow = new Date(`${e.date}T00:00:00`).getDay();
      if (dow === 0 || dow === 6) list.push("weekend");
      if (e.isBillable && (e.notes ?? "").trim().length < 4) list.push("no_notes");
      if ((dupes.get([e.userId, e.date, e.customerId, e.jobId ?? "", e.serviceItemId, e.durationMinutes].join("|")) ?? 0) > 1) list.push("duplicate");
      if (e.date > today) list.push("future");
      out.set(e.id, list);
    }
    return out;
  }, [entries]);

  // Checks an accountant dismissed for a specific entry no longer count (the entry keeps them so they can be restored).
  const issues = useMemo(() => {
    const out = new Map<string, Issue[]>();
    for (const e of entries) out.set(e.id, (rawIssues.get(e.id) ?? []).filter((i) => i === "edited" || !(e.dismissedIssues ?? []).includes(i)));
    return out;
  }, [entries, rawIssues]);

  const dismissIssue = async (e: TimeEntryItem, issue: Issue, dismissed: boolean) => {
    const cur = e.dismissedIssues ?? [];
    const next = dismissed ? Array.from(new Set([...cur, issue])) : cur.filter((x) => x !== issue);
    setEntries((all) => all.map((x) => (x.id === e.id ? { ...x, dismissedIssues: next } : x))); // instant
    const res = await fetch(`/api/time-entries/${e.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dismissedIssues: next }) });
    if (!res.ok) { await load(); setToast({ text: "Couldn't save that." }); }
    else setToast({ text: dismissed ? `Dismissed “${ISSUES[issue].label}” for that entry.` : `Brought back “${ISSUES[issue].label}”.`, action: dismissed ? { label: "Undo", run: () => dismissIssue({ ...e, dismissedIssues: next }, issue, false) } : undefined });
  };

  const [start, end] = range(period, from, to);
  const inPeriod = useMemo(
    () =>
      entries.filter(
        (e) => (!start || e.date >= start) && (!end || e.date <= end) && (person === "all" || e.userId === person) && (customer === "all" || e.customerId === customer) && matchesFilters(e, extra)
      ),
    [entries, start, end, person, customer, extra]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inPeriod
      .filter((e) => {
        if (status === "review" && e.status !== "submitted" && e.status !== "draft") return false;
        if (status === "approved" && e.status !== "approved") return false;
        if (status === "exported" && e.status !== "exported") return false;
        if (status === "flagged" && !e.flagged) return false;
        const list = issues.get(e.id) ?? [];
        if (issueFilter === "any" && list.length === 0) return false;
        if (issueFilter && issueFilter !== "any" && !list.includes(issueFilter)) return false;
        if (q && ![e.date, e.userName, e.customerName, e.jobName, e.serviceItemName, e.notes].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName));
  }, [inPeriod, status, issueFilter, query, issues]);

  const stats = useMemo(() => {
    const s = { review: { n: 0, m: 0 }, flagged: { n: 0, m: 0 }, approved: { n: 0, m: 0 }, exported: { n: 0, m: 0 }, total: 0, billable: 0, amount: 0 };
    for (const e of inPeriod) {
      s.total += e.durationMinutes;
      if (e.isBillable) { s.billable += e.durationMinutes; s.amount += (e.durationMinutes / 60) * (rate.get(e.userId) ?? 0); }
      if (e.status === "submitted" || e.status === "draft") { s.review.n++; s.review.m += e.durationMinutes; }
      if (e.status === "approved") { s.approved.n++; s.approved.m += e.durationMinutes; }
      if (e.status === "exported") { s.exported.n++; s.exported.m += e.durationMinutes; }
      if (e.flagged) { s.flagged.n++; s.flagged.m += e.durationMinutes; }
    }
    return s;
  }, [inPeriod, rate]);

  const issueCounts = useMemo(() => {
    const c: Record<Issue, number> = { edited: 0, missing: 0, long_day: 0, weekend: 0, no_notes: 0, duplicate: 0, future: 0 };
    let any = 0;
    for (const e of inPeriod) {
      if (e.status === "approved" || e.status === "exported") { if (!e.flagged) continue; }
      const l = issues.get(e.id) ?? [];
      if (l.length) any++;
      l.forEach((i) => c[i]++);
    }
    return { c, any };
  }, [inPeriod, issues]);

  const cleanReady = useMemo(
    () => inPeriod.filter((e) => (e.status === "submitted" || e.status === "draft") && !isOwn(e) && !(issues.get(e.id) ?? []).some((i) => i !== "weekend")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inPeriod, issues, isManager, me?.id]
  );

  const [queryFor, setQueryFor] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");

  /** Send an entry back to the engineer with a question; it shows as flagged on their timesheet. */
  const sendBack = async (id: string) => {
    const text = queryText.trim();
    if (!text) return;
    const res = await fetch(`/api/time-entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted", flagged: true, flagReason: `Accountant asks: ${text}`.slice(0, 500) }),
    });
    setQueryFor(null);
    setQueryText("");
    await load();
    setToast({ text: res.ok ? "Sent back with your note — it's flagged on their timesheet." : "Couldn't send that back." });
  };

  /** Un-ask: withdraw a question / clear the flag. The notes stay in the entry's history. */
  const withdraw = async (id: string) => {
    const res = await fetch(`/api/time-entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: false }),
    });
    await load();
    setToast({ text: res.ok ? "Question withdrawn — the flag is cleared (the notes are kept)." : "Couldn't withdraw that." });
  };

  const setStatusFor = async (wanted: string[], next: TimeEntryItem["status"], text?: string) => {
    // Nobody but an accountant/admin can act on their own time.
    const mine = new Set(entries.filter(isOwn).map((e) => e.id));
    const ids = wanted.filter((id) => !mine.has(id));
    if (ids.length < wanted.length) {
      setToast({ text: ids.length ? `${wanted.length - ids.length} of your own ${wanted.length - ids.length === 1 ? "entry was" : "entries were"} skipped — someone else has to approve your time.` : "You can't approve your own time — someone else has to." });
      if (!ids.length) return;
    }
    if (!ids.length) return;
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/time-entries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then((r) => r.ok))
    );
    const failed = results.filter((ok) => !ok).length;
    setPicked(new Set());
    await load();
    setToast({ text: failed ? `${failed} of ${ids.length} couldn't be updated.` : text ?? `${ids.length} ${ids.length === 1 ? "entry" : "entries"} → ${next}.` });
  };

  const params = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (start) p.set("startDate", start);
    if (end) p.set("endDate", end);
    if (person !== "all") p.set("userId", person);
    if (customer !== "all") p.set("customerId", customer);
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  };

  const exportApproved = (kind: "iif" | "csv") => {
    const ids = inPeriod.filter((e) => e.status === "approved").map((e) => e.id);
    if (!ids.length) return setToast({ text: "Nothing approved to export in this view yet — approve entries first." });
    // The QuickBooks file only carries entries that have both a customer and a task (otherwise QuickBooks rejects or mis-files them).
    const sendable = kind === "iif" ? inPeriod.filter((e) => e.status === "approved" && e.customerId && e.serviceItemId) : inPeriod.filter((e) => e.status === "approved");
    const sendIds = sendable.map((e) => e.id);
    const left = ids.length - sendIds.length;
    if (!sendIds.length) return setToast({ text: "None of the approved entries have both a customer and a task, so there's nothing to put in the QuickBooks file yet. Ask the engineers to fill those in." });
    window.location.href = `/api/export/${kind}?${params({ status: "approved" })}`;
    setToast({
      text: `Downloading ${sendIds.length} approved ${sendIds.length === 1 ? "entry" : "entries"}.${left ? ` ${left} left out — no customer or task (see “No customer or task”).` : ""} Once it’s imported into QuickBooks, mark them exported so they aren’t sent twice.`,
      action: isManager ? { label: "Mark as exported", run: () => setStatusFor(sendIds, "exported", `${sendIds.length} marked exported.`) } : undefined,
    });
  };

  const allPicked = visible.length > 0 && visible.every((e) => picked.has(e.id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const nameOfUser = (id: string) => users.find((u) => u.id === id)?.name ?? "";

  const byPerson = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number; billable: number; amount: number; n: number; flagged: number }>();
    for (const e of inPeriod) {
      const r = m.get(e.userId) ?? { id: e.userId, name: e.userName, total: 0, billable: 0, amount: 0, n: 0, flagged: 0 };
      r.total += e.durationMinutes; r.n++; if (e.flagged) r.flagged++;
      if (e.isBillable) { r.billable += e.durationMinutes; r.amount += (e.durationMinutes / 60) * (rate.get(e.userId) ?? 0); }
      m.set(e.userId, r);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [inPeriod, rate]);

  const byCustomer = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number; billable: number; amount: number; jobs: Map<string, number> }>();
    for (const e of inPeriod) {
      const r = m.get(e.customerId) ?? { id: e.customerId, name: e.customerName || "No customer", total: 0, billable: 0, amount: 0, jobs: new Map() };
      r.total += e.durationMinutes;
      r.jobs.set(e.jobName ?? "No project", (r.jobs.get(e.jobName ?? "No project") ?? 0) + e.durationMinutes);
      if (e.isBillable) { r.billable += e.durationMinutes; r.amount += (e.durationMinutes / 60) * (rate.get(e.userId) ?? 0); }
      m.set(e.customerId, r);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [inPeriod, rate]);

  // Pay weeks (Sun–Sat): per week, per person — hours, status, and the entries still waiting for approval.
  const byWeek = useMemo(() => {
    type P = { id: string; name: string; total: number; billable: number; n: number; flagged: number; approved: number; exported: number; submittedIds: string[] };
    const m = new Map<string, { total: number; billable: number; people: Map<string, P> }>();
    for (const e of inPeriod) {
      const wk = weekStart(e.date);
      const w = m.get(wk) ?? { total: 0, billable: 0, people: new Map<string, P>() };
      const p = w.people.get(e.userId) ?? { id: e.userId, name: e.userName, total: 0, billable: 0, n: 0, flagged: 0, approved: 0, exported: 0, submittedIds: [] };
      p.total += e.durationMinutes; p.n++;
      if (e.isBillable) { p.billable += e.durationMinutes; w.billable += e.durationMinutes; }
      if (e.flagged) p.flagged++;
      if (e.status === "approved") p.approved++; else if (e.status === "exported") p.exported++; else if (!isOwn(e)) p.submittedIds.push(e.id);
      w.total += e.durationMinutes;
      w.people.set(e.userId, p);
      m.set(wk, w);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([wk, w]) => ({ wk, ...w, people: Array.from(w.people.values()).sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [inPeriod]);
  // The newest week starts open; the rest start closed.
  const isWeekOpen = (wk: string, i: number) => weekOpen[wk] ?? i === 0;

  const card = (key: StatusFilter, label: string, n: number, m: number, tone: string, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={() => setStatus(status === key ? "all" : key)}
      aria-pressed={status === key}
      data-testid={`card-${key}`}
      className={cn(
        "flex flex-col gap-1 rounded-[22px] border p-3 text-left transition-all sm:p-4",
        status === key ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-card hover:border-outline"
      )}
    >
      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]", tone)}>{icon}{label}</span>
      <span className="m3-metric text-2xl leading-none">{n}</span>
      <span className="text-xs text-muted-foreground">{hrs(m)} h</span>
    </button>
  );

  // ── one filter system: everything that narrows the list is summarised (and removable) here ──
  const STATUS_LABEL: Record<StatusFilter, string> = { all: "", review: "To review", flagged: "Edited / flagged", approved: "Approved", exported: "Exported" };
  const nameOf = (key: "jobId" | "serviceItemId", id: string) => {
    const e = entries.find((x) => x[key] === id);
    return key === "jobId" ? e?.jobName : e?.serviceItemName;
  };
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (period !== "all") activeChips.push({ key: "period", label: PERIODS.find((p) => p.id === period)!.label, clear: () => setPeriod("all") });
  if (isManager && person !== "all") activeChips.push({ key: "person", label: nameOfUser(person) || "Person", clear: () => setPerson("all") });
  if (customer !== "all") activeChips.push({ key: "customer", label: customers.find((c) => c.id === customer)?.name ?? "Customer", clear: () => { setCustomer("all"); setExtra((x) => ({ ...x, project: "" })); } });
  if (extra.project) activeChips.push({ key: "project", label: `Project: ${nameOf("jobId", extra.project) ?? ""}`, clear: () => setExtra((x) => ({ ...x, project: "" })) });
  if (extra.task) activeChips.push({ key: "task", label: `Task: ${nameOf("serviceItemId", extra.task) ?? ""}`, clear: () => setExtra((x) => ({ ...x, task: "" })) });
  if (extra.billable !== "all") activeChips.push({ key: "billable", label: extra.billable === "billable" ? "Billable only" : "Non-billable only", clear: () => setExtra((x) => ({ ...x, billable: "all" })) });
  if (extra.location) activeChips.push({ key: "location", label: `Location: ${locationLabel(extra.location)}`, clear: () => setExtra((x) => ({ ...x, location: "" })) });
  if (status !== "all") activeChips.push({ key: "status", label: STATUS_LABEL[status], clear: () => setStatus("all") });
  if (issueFilter) activeChips.push({ key: "issue", label: issueFilter === "any" ? "Has a check" : ISSUES[issueFilter].label, clear: () => setIssueFilter(null) });
  if (query.trim()) activeChips.push({ key: "q", label: `“${query.trim()}”`, clear: () => setQuery("") });
  const clearAll = () => {
    setPeriod("all"); setPerson("all"); setCustomer("all"); setStatus("all"); setIssueFilter(null); setQuery(""); setExtra(NO_FILTERS);
  };
  // Submitted time that the current filters are hiding (the usual "where did that entry go?" question).
  const hiddenSubmitted = entries.filter((e) => e.status === "submitted").length - visible.filter((e) => e.status === "submitted").length;

  const chip = (active: boolean) =>
    cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", active ? "border-transparent bg-primary text-primary-foreground" : "border-outline-variant text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground");
  const select = "m3-select h-9 w-full cursor-pointer appearance-none rounded-full border border-outline-variant bg-surface-low pl-3 pr-8 text-xs font-medium outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25";

  return (
    <>
    <div className="flex w-full flex-col gap-4 px-3 py-4 pb-24 sm:px-6 sm:py-5 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Review &amp; export</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Check what engineers submitted, approve it, then send approved time to QuickBooks. Anything an engineer changes after you approved it comes back here flagged.
          </p>
        </div>
        <div className="print-hide flex flex-wrap gap-2">
          <button onClick={() => exportApproved("iif")} data-testid="export-iif" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110">
            <Download className="h-4 w-4" />QuickBooks .IIF
          </button>
          <button onClick={() => exportApproved("csv")} className="inline-flex h-10 items-center gap-2 rounded-full border border-outline-variant px-4 text-sm font-semibold transition hover:bg-foreground/[0.05]">
            <FileSpreadsheet className="h-4 w-4" />CSV
          </button>
          <button onClick={() => window.print()} aria-label="Print" title="Print a clean report of what is listed" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant transition hover:bg-foreground/[0.05]">
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="print-hide space-y-3 rounded-[22px] border border-border/70 bg-card p-3 shadow-sm">
        <div className="m3-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)} aria-pressed={period === p.id} className={chip(period === p.id)}>{p.label}</button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-full border border-outline-variant bg-surface-low px-3 outline-none focus:border-primary" />
            <span className="text-muted-foreground">to</span>
            <input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-full border border-outline-variant bg-surface-low px-3 outline-none focus:border-primary" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[12rem_14rem_1fr]">
          <Dropdown
            aria-label="Person"
            value={person}
            onChange={setPerson}
            disabled={!isManager}
            options={[...(isManager ? [{ value: "all", label: "Everyone" }] : []), ...(isManager ? users : users.filter((u) => u.id === me?.id)).map((u) => ({ value: u.id, label: u.name }))]}
          />
          <Dropdown
            aria-label="Customer"
            value={customer}
            onChange={(v) => { setCustomer(v); setExtra((x) => ({ ...x, project: "" })); }}
            options={[{ value: "all", label: "All customers" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people, customers, notes…" aria-label="Search entries" className="h-9 w-full rounded-full border border-outline-variant bg-surface-low pl-8 pr-3 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25" />
          </div>
        </div>
        <FilterPanel entries={entries} value={extra} onChange={setExtra} fields={["project", "task", "billable", "location"]} customerId={customer === "all" ? "" : customer} label="More filters" />
        {activeChips.length > 0 && (
          <div data-testid="active-filters" className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
            <span className="m3-label mr-1">Showing</span>
            {activeChips.map((c) => (
              <button key={c.key} onClick={c.clear} aria-label={`Remove filter ${c.label}`} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-2 text-xs font-semibold text-primary transition hover:bg-primary/20">
                {c.label}<X className="h-3 w-3" />
              </button>
            ))}
            <button onClick={clearAll} data-testid="clear-all-filters" className="ml-1 inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground">Clear all</button>
          </div>
        )}
      </div>
      {hiddenSubmitted > 0 && (
        <div role="status" data-testid="hidden-submitted" className="print-hide flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-warning-container/60 px-4 py-2.5 text-sm">
          <span><strong>{hiddenSubmitted}</strong> submitted {hiddenSubmitted === 1 ? "entry is" : "entries are"} hidden by the filters above.</span>
          <button onClick={clearAll} className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm transition hover:brightness-95">Show everything</button>
        </div>
      )}

      {/* Pipeline */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        {card("review", "To review", stats.review.n, stats.review.m, "text-primary", <Send className="h-3.5 w-3.5" />)}
        {card("flagged", "Edited / flagged", stats.flagged.n, stats.flagged.m, "text-destructive", <Flag className="h-3.5 w-3.5" />)}
        {card("approved", "Approved", stats.approved.n, stats.approved.m, "text-tertiary", <BadgeCheck className="h-3.5 w-3.5" />)}
        {card("exported", "Exported", stats.exported.n, stats.exported.m, "text-secondary", <CheckCircle2 className="h-3.5 w-3.5" />)}
        <div className="col-span-2 flex flex-col gap-1 rounded-[22px] border border-border/70 bg-card p-3 sm:p-4 lg:col-span-1">
          <span className="m3-label">{isManager ? "Billable value" : "Billable hours"}</span>
          <span className="m3-metric text-2xl leading-none">{isManager ? money(stats.amount) : `${hrs(stats.billable)} h`}</span>
          <span className="text-xs text-muted-foreground">
            {hrs(stats.billable)} of {hrs(stats.total)} h billable{stats.total ? ` · ${Math.round((stats.billable / stats.total) * 100)}%` : ""}
          </span>
        </div>
      </div>

      {/* Needs attention */}
      {issueCounts.any > 0 && (
        <section className="rounded-[22px] border border-warning/40 bg-warning-container/30 p-3 sm:p-4" aria-label="Needs attention">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold">Worth a second look</h2>
            <span className="text-xs text-muted-foreground">Automatic checks on this period — click one to filter.</span>
            {issueFilter && <button onClick={() => setIssueFilter(null)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary"><X className="h-3 w-3" />Clear</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ISSUES) as Issue[]).filter((i) => issueCounts.c[i] > 0).map((i) => (
              <button
                key={i}
                title={ISSUES[i].help}
                onClick={() => setIssueFilter(issueFilter === i ? null : i)}
                aria-pressed={issueFilter === i}
                className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-border transition", ISSUES[i].tone, issueFilter === i && "ring-2 ring-primary")}
              >
                {ISSUES[i].label}<span className="rounded-full bg-background/60 px-1.5 font-mono text-[11px]">{issueCounts.c[i]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quick approve */}
      {cleanReady.length > 0 && (
        <div className="print-hide flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-tertiary/30 bg-tertiary-container/30 px-4 py-3">
          <p className="text-sm"><span className="font-semibold">{cleanReady.length}</span> submitted {cleanReady.length === 1 ? "entry has" : "entries have"} no issues and {cleanReady.length === 1 ? "is" : "are"} ready to approve.</p>
          <button onClick={() => setStatusFor(cleanReady.map((e) => e.id), "approved", `Approved ${cleanReady.length} clean ${cleanReady.length === 1 ? "entry" : "entries"}.`)} data-testid="approve-clean" className="inline-flex h-9 items-center gap-2 rounded-full bg-tertiary px-4 text-xs font-semibold text-tertiary-foreground transition hover:brightness-110">
            <CheckCheck className="h-4 w-4" />Approve all clean
          </button>
        </div>
      )}

      {(draftCount > 0 || users.length > 0) && (
        <div className="print-hide flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {draftCount > 0
              ? isManager
                ? `${draftCount} ${draftCount === 1 ? "entry is" : "entries are"} still a draft — engineers haven’t submitted ${draftCount === 1 ? "it" : "them"} yet.`
                : `${draftCount} of your ${draftCount === 1 ? "entry is" : "entries are"} still a draft — submit ${draftCount === 1 ? "it" : "them"} from the Timesheet.`
              : isManager ? "All logged time has been submitted." : "All your time has been submitted."}
          </span>
          <ExcelExport
            userId={isManager ? xlPerson : me?.id ?? ""}
            onPerson={isManager ? setXlPerson : undefined}
            people={isManager ? users.map((u) => ({ id: u.id, name: u.name })) : undefined}
            weeks={Array.from(new Set(entries.filter((e) => (isManager ? !xlPerson || e.userId === xlPerson : true)).map((e) => weekStart(e.date))))}
          />
        </div>
      )}

      {/* View tabs */}
      <div className="print-hide flex gap-1 self-start rounded-full bg-surface-container p-1" role="tablist">
        {([["entries", `Entries (${visible.length})`], ["weeks", "By week"], ["people", "By person"], ["customers", "By customer"], ["projects", "By project"], ["grid", "Person × time"]] as [View, string][]).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded-full px-4 py-1.5 text-xs font-semibold transition", view === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {loading ? (
        <PageLoader label="Loading entries…" />
      ) : view === "entries" ? (
        <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
          <div className="stack-table-wrap m3-scroll max-h-[calc(100dvh-14rem)] min-h-[12rem] overflow-auto">
            <table className="stack-table w-full min-w-[64rem] border-separate border-spacing-0 text-left text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                  <th className="w-10 text-center"><input type="checkbox" aria-label="Select all" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(visible.map((e) => e.id)))} className="h-4 w-4 accent-[hsl(var(--primary))]" /></th>
                  <th className="w-28">Date</th><th className="w-36">Person</th><th>Customer · project</th><th className="w-44">Task</th>
                  <th className="w-24 text-right">Hours</th>{isManager && <th className="w-24 text-right">Value</th>}<th className="w-28">Status</th><th className="w-48">Issues</th><th className="w-28" />
                </tr>
              </thead>
              <tbody className="[&_td]:border-b [&_td]:border-border/70">
                {visible.map((e) => {
                  const list = issues.get(e.id) ?? [];
                  const open = e.status === "submitted" || e.status === "draft";
                  return (
                    <tr key={e.id} className={cn("hover:bg-surface-low", e.flagged && "bg-destructive/[0.04]", picked.has(e.id) && "bg-primary/5")}>
                      <td className="text-center"><input type="checkbox" aria-label={`Select ${e.customerName || "no customer"} ${e.date}`} checked={picked.has(e.id)} onChange={() => toggle(e.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" /></td>
                      <td data-label="Date" className="whitespace-nowrap px-2 py-2 font-mono text-xs">{e.date}</td>
                      <td data-label="Person" className="px-2 py-2">{e.userName}</td>
                      <td data-label="Customer · project" className="span-2 px-2 py-2">
                        <div className="font-medium">{e.customerName || <span className="font-normal italic text-muted-foreground">No customer</span>}{e.jobName && <span className="font-normal text-muted-foreground"> · {e.jobName}</span>}</div>
                        {e.notes && <div className="max-w-md truncate text-xs text-muted-foreground">{e.notes}</div>}
                      </td>
                      <td data-label="Task" className="px-2 py-2 text-muted-foreground">{e.serviceItemName || "—"}</td>
                      <td data-label="Hours" className="px-2 py-2 text-right font-mono tabular-nums">{hrs(e.durationMinutes)}{!e.isBillable && <span className="block whitespace-nowrap font-sans text-[10px] leading-3 text-muted-foreground">non-billable</span>}</td>
                      {isManager && <td data-label="Value" className="px-2 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">{e.isBillable ? money((e.durationMinutes / 60) * (rate.get(e.userId) ?? 0)) : "—"}</td>}
                      <td data-label="Status" className="px-2 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLE[e.status])}>{e.status}</span></td>
                      <td data-label="Issues" className="span-2 px-2 py-2">
                        {list.length === 0 && !(e.dismissedIssues ?? []).some((i) => (rawIssues.get(e.id) ?? []).includes(i as Issue)) ? <span className="text-xs text-muted-foreground/60">—</span> : (
                          <div className="flex flex-wrap gap-1">
                            {list.map((i) => (
                              <span key={i} title={i === "edited" ? e.flagReason ?? ISSUES[i].help : ISSUES[i].help} className={cn("inline-flex items-center gap-0.5 rounded-full py-0.5 pl-2 text-[11px] font-medium", i === "edited" ? "pr-2" : "pr-0.5", ISSUES[i].tone)}>
                                {ISSUES[i].short}
                                {i !== "edited" && (
                                  <button onClick={() => dismissIssue(e, i, true)} aria-label={`Dismiss ${ISSUES[i].short} for ${e.userName} ${e.date}`} title="Dismiss this check for this entry" className="rounded-full p-0.5 opacity-60 transition hover:bg-foreground/10 hover:opacity-100"><X className="h-3 w-3" /></button>
                                )}
                              </span>
                            ))}
                            {(rawIssues.get(e.id) ?? []).filter((i) => (e.dismissedIssues ?? []).includes(i)).map((i) => (
                              <button key={`d-${i}`} onClick={() => dismissIssue(e, i, false)} aria-label={`Restore ${ISSUES[i].short} for ${e.userName} ${e.date}`} title="Dismissed — click to bring this check back" className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground line-through transition hover:bg-foreground/[0.05]">
                                <RotateCcw className="h-3 w-3 no-underline" />{ISSUES[i].short}
                              </button>
                            ))}
                          </div>
                        )}
                        {e.flagged && e.flagReason && <div className="mt-1 text-[11px] leading-snug text-destructive">{e.flagReason}</div>}
                        {(e.flagHistory?.length ?? 0) > 0 && (
                          <details className="mt-1 text-[11px] text-muted-foreground">
                            <summary className="cursor-pointer select-none">{e.flagHistory!.length} flag {e.flagHistory!.length === 1 ? "note" : "notes"}</summary>
                            <ul className="mt-1 space-y-1">
                              {[...e.flagHistory!].reverse().map((h, i) => (
                                <li key={i}><span className="font-semibold text-foreground">{h.by}</span> · {new Date(h.at).toLocaleDateString([], { month: "short", day: "numeric" })} — {h.text}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                      <td className="actions-cell px-2 py-2">
                        {queryFor === e.id && (
                          <form
                            onSubmit={(ev) => { ev.preventDefault(); sendBack(e.id); }}
                            className="mb-1 flex items-center gap-1"
                          >
                            <input
                              autoFocus
                              value={queryText}
                              onChange={(ev) => setQueryText(ev.target.value)}
                              onKeyDown={(ev) => { if (ev.key === "Escape") setQueryFor(null); }}
                              maxLength={400}
                              placeholder="Question for them…"
                              aria-label="Question for the engineer"
                              className="h-8 min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-low px-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                            />
                            <button type="submit" disabled={!queryText.trim()} className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Send className="h-3.5 w-3.5" />Send</button>
                            <button type="button" aria-label="Cancel" onClick={() => setQueryFor(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06]"><X className="h-3.5 w-3.5" /></button>
                          </form>
                        )}
                        <div className="flex justify-end gap-1">
                          {isOwn(e) && <span className="self-center text-[11px] text-muted-foreground">Your own time</span>}
                          {!isOwn(e) && queryFor !== e.id && (
                            <button onClick={() => { setQueryFor(e.id); setQueryText(""); }} title="Ask the engineer a question about this entry" aria-label="Query" className="inline-flex h-8 items-center gap-1 rounded-full border border-outline-variant px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05]"><Flag className="h-3.5 w-3.5" /><span className="hidden max-md:inline 2xl:inline">Query</span></button>
                          )}
                          {!isOwn(e) && e.flagged && queryFor !== e.id && (
                            <button onClick={() => withdraw(e.id)} title="Withdraw the question and clear the flag (the notes are kept)" aria-label="Withdraw question" className="inline-flex h-8 items-center gap-1 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.06]"><Undo2 className="h-3.5 w-3.5" />Withdraw</button>
                          )}
                          {isOwn(e) ? null : open ? (
                            <button onClick={() => setStatusFor([e.id], "approved", "Approved.")} className="inline-flex h-8 items-center gap-1 rounded-full bg-tertiary-container px-3 text-xs font-semibold text-tertiary-on-container transition hover:brightness-95"><CheckCircle2 className="h-3.5 w-3.5" />Approve</button>
                          ) : (
                            <button onClick={() => setStatusFor([e.id], "submitted", "Sent back for review.")} title="Reopen — sends it back to submitted" className="inline-flex h-8 items-center gap-1 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05]"><RotateCcw className="h-3.5 w-3.5" />Reopen</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr className="group-row"><td colSpan={10} className="py-12 text-center text-sm text-muted-foreground">Nothing matches these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/70 px-4 py-2 text-xs text-muted-foreground">
            {visible.length} {visible.length === 1 ? "entry" : "entries"} · {hrs(visible.reduce((n, e) => n + e.durationMinutes, 0))} h
          </div>
        </section>
      ) : view === "weeks" ? (
        <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm" aria-label="Hours by pay week">
          {byWeek.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No time in this period.</div>}
          {byWeek.map((w, i) => {
            const open = isWeekOpen(w.wk, i);
            const waiting = w.people.reduce((n, p) => n + p.submittedIds.length, 0);
            return (
              <div key={w.wk} className="border-b border-border/70 last:border-b-0" data-week={w.wk}>
                <button
                  type="button"
                  onClick={() => setWeekOpen((o) => ({ ...o, [w.wk]: !open }))}
                  aria-expanded={open}
                  data-testid="pay-week-toggle"
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 bg-surface-container px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.04]"
                >
                  {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="text-sm font-semibold">{weekRangeLabel(w.wk)}</span>
                  {weekTag(w.wk) && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{weekTag(w.wk)}</span>}
                  <span className="font-mono text-sm font-semibold tabular-nums">{hrs(w.total)} h</span>
                  <span className="text-xs text-muted-foreground">{hrs(w.billable)} h billable · {w.people.length} {w.people.length === 1 ? "person" : "people"}</span>
                  {waiting > 0 && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{waiting} to review</span>}
                </button>
                {waiting > 0 && (
                  <div className="flex justify-end border-t border-border/70 bg-surface-container/60 px-3 py-1.5">
                    <button
                      onClick={() => setStatusFor(w.people.flatMap((p) => p.submittedIds), "approved", `Approved everyone’s week of ${weekRangeLabel(w.wk)} (${waiting} ${waiting === 1 ? "entry" : "entries"}).`)}
                      aria-label={`Approve everyone’s week of ${weekRangeLabel(w.wk)}`}
                      data-testid="approve-whole-week"
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-tertiary-container px-3 text-xs font-semibold text-tertiary-on-container transition hover:brightness-95"
                    ><CheckCheck className="h-3.5 w-3.5" />Approve whole week ({waiting})</button>
                  </div>
                )}
                {open && (
                  <div className="stack-table-wrap overflow-x-auto">
                    <table className="stack-table w-full min-w-[36rem] border-separate border-spacing-0 text-left text-[13px]">
                      <tbody className="[&_td]:border-t [&_td]:border-border/70">
                        {w.people.map((p) => (
                          <tr key={p.id}>
                            <td data-label="Person" className="span-2 px-3 py-2.5 pl-10 font-medium">
                              {isManager ? <button onClick={() => { setPerson(p.id); setView("entries"); }} title={`Show ${p.name}'s entries`} className="rounded text-left underline-offset-2 hover:text-primary hover:underline">{p.name}</button> : p.name}
                            </td>
                            <td data-label="Hours" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(p.total)}</td>
                            <td data-label="Billable" className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{hrs(p.billable)}</td>
                            <td data-label="Entries" className="span-2 px-3 py-2.5 text-xs text-muted-foreground">
                              {p.n} {p.n === 1 ? "entry" : "entries"}
                              {p.flagged > 0 && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">{p.flagged} flagged</span>}
                              {p.submittedIds.length > 0 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{p.submittedIds.length} to review</span>}
                              {p.approved > 0 && <span className="ml-2 rounded-full bg-tertiary-container px-2 py-0.5 font-medium text-tertiary-on-container">{p.approved} approved</span>}
                              {p.exported > 0 && <span className="ml-2 rounded-full bg-surface-high px-2 py-0.5 font-medium">{p.exported} exported</span>}
                            </td>
                            <td className="actions-cell px-3 py-2 text-right">
                              {p.submittedIds.length > 0 ? (
                                <button
                                  onClick={() => setStatusFor(p.submittedIds, "approved", `Approved ${p.name}'s week of ${weekRangeLabel(w.wk)}.`)}
                                  aria-label={`Approve ${p.name}'s week of ${weekRangeLabel(w.wk)}`}
                                  className="inline-flex h-8 items-center gap-1 rounded-full bg-tertiary-container px-3 text-xs font-semibold text-tertiary-on-container transition hover:brightness-95"
                                ><CheckCircle2 className="h-3.5 w-3.5" />Approve week</button>
                              ) : <span className="text-xs text-muted-foreground/60">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : view === "projects" ? (
        <ProjectReport entries={inPeriod} />
      ) : view === "grid" ? (
        <PersonTimeReport entries={inPeriod} />
      ) : (
        <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
          <div className="stack-table-wrap m3-scroll overflow-auto">
            <table className="stack-table w-full min-w-[40rem] border-separate border-spacing-0 text-left text-[13px]">
              <thead>
                <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground">
                  <th>{view === "people" ? "Person" : "Customer"}</th><th className="text-right">Hours</th><th className="text-right">Billable</th>{isManager && <th className="text-right">Value</th>}
                  <th>{view === "people" ? "Entries" : "Projects"}</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-b [&_td]:border-border/70">
                {view === "people"
                  ? byPerson.map((r) => (
                      <tr key={r.name}>
                        <td data-label="Person" className="span-2 px-3 py-2.5 font-medium">
                          {isManager ? <button onClick={() => { setPerson(r.id); setView("entries"); }} title={`Show ${r.name}'s entries`} className="rounded text-left underline-offset-2 hover:text-primary hover:underline">{r.name}</button> : r.name}
                        </td>
                        <td data-label="Hours" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(r.total)}</td>
                        <td data-label="Billable" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(r.billable)}</td>
                        {isManager && <td data-label="Value" className="px-3 py-2.5 text-right font-mono tabular-nums">{money(r.amount)}</td>}
                        <td data-label="Entries" className="px-3 py-2.5 text-xs text-muted-foreground">{r.n}{r.flagged > 0 && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">{r.flagged} flagged</span>}</td>
                      </tr>
                    ))
                  : byCustomer.map((r) => (
                      <tr key={r.name}>
                        <td data-label="Customer" className="span-2 px-3 py-2.5 font-medium">
                          {r.id ? <button onClick={() => { setCustomer(r.id); setView("entries"); }} title={`Show ${r.name} entries`} className="rounded text-left underline-offset-2 hover:text-primary hover:underline">{r.name}</button> : r.name}
                        </td>
                        <td data-label="Hours" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(r.total)}</td>
                        <td data-label="Billable" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(r.billable)}</td>
                        {isManager && <td data-label="Value" className="px-3 py-2.5 text-right font-mono tabular-nums">{money(r.amount)}</td>}
                        <td data-label="Projects" className="span-2 px-3 py-2.5 text-xs text-muted-foreground">{Array.from(r.jobs).map(([j, m]) => `${j} ${hrs(m)}h`).join(" · ")}</td>
                      </tr>
                    ))}
                {(view === "people" ? byPerson : byCustomer).length === 0 && (
                  <tr className="group-row"><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No time in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bulk bar */}
      {picked.size > 0 && (
        <div role="region" aria-label="Selected entries" className="print-hide fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-background shadow-2xl">
          <span className="mr-auto text-sm font-semibold">{picked.size} selected</span>
          <button onClick={() => setStatusFor(Array.from(picked), "approved")} className="rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold hover:bg-background/25">Approve</button>
          <button onClick={() => setStatusFor(Array.from(picked), "exported")} className="rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold hover:bg-background/25">Mark exported</button>
          <button onClick={() => setStatusFor(Array.from(picked), "submitted")} className="rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold hover:bg-background/25">Reopen</button>
          <button onClick={() => setPicked(new Set())} aria-label="Clear selection" className="rounded-full p-1.5 hover:bg-background/15"><X className="h-4 w-4" /></button>
        </div>
      )}

      {toast && (
        <div role="status" className="print-hide fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-xl animate-m3-rise items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-sm text-background shadow-2xl">
          <span className="flex-1">{toast.text}</span>
          {toast.action && <button onClick={() => { toast.action!.run(); }} className="shrink-0 rounded-full bg-background/20 px-3 py-1 text-xs font-semibold hover:bg-background/30">{toast.action.label}</button>}
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="shrink-0 rounded-full p-1 hover:bg-background/15"><X className="h-4 w-4" /></button>
        </div>
      )}
    </div>
    {printing && <PrintSheet
      entries={visible}
      title="Time review"
      filters={activeChips.map((c) => c.label)}
      showValue={isManager}
      rate={rate}
    />}
    </>
  );
}

export default function Page() {
  return (
    <AccountantPage />
  );
}
