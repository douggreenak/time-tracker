"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { useDirectory } from "@/lib/useDirectory";
import { weekRangeLabel, weekStart } from "@/lib/weeks";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/components/ui";

const hrs = (m: number) => (m / 60).toFixed(2);
const th = "h-9 border-b border-border bg-surface-container px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

function csvCell(v: string | number) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formulas are defused
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function download(name: string, rows: (string | number)[][]) {
  const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CsvButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold text-muted-foreground transition hover:bg-foreground/[0.05] hover:text-foreground"
    >
      <Download className="h-3.5 w-3.5" />CSV
    </button>
  );
}

/** Time spent per project, optionally broken down by task (with its QuickBooks item / code). */
export function ProjectReport({ entries }: { entries: TimeEntryItem[] }) {
  const dir = useDirectory();
  const [byTask, setByTask] = useState(false);
  const code = useMemo(() => new Map(dir.serviceItems.map((s) => [s.id, s.qbItemName])), [dir.serviceItems]);

  const groups = useMemo(() => {
    type Task = { id: string; name: string; code: string; total: number; billable: number; n: number };
    type G = { key: string; customer: string; project: string; total: number; billable: number; n: number; tasks: Map<string, Task> };
    const m = new Map<string, G>();
    for (const e of entries) {
      const key = `${e.customerId}|${e.jobId ?? ""}`;
      const g = m.get(key) ?? { key, customer: e.customerName || "No customer", project: e.jobName || "No project", total: 0, billable: 0, n: 0, tasks: new Map() };
      g.total += e.durationMinutes; g.n++;
      if (e.isBillable) g.billable += e.durationMinutes;
      const t = g.tasks.get(e.serviceItemId) ?? { id: e.serviceItemId, name: e.serviceItemName || "No task", code: code.get(e.serviceItemId) ?? "", total: 0, billable: 0, n: 0 };
      t.total += e.durationMinutes; t.n++;
      if (e.isBillable) t.billable += e.durationMinutes;
      g.tasks.set(e.serviceItemId, t);
      m.set(key, g);
    }
    return Array.from(m.values()).sort((a, b) => a.customer.localeCompare(b.customer) || a.project.localeCompare(b.project));
  }, [entries, code]);

  const total = groups.reduce((s, g) => s + g.total, 0);
  const billable = groups.reduce((s, g) => s + g.billable, 0);

  const exportCsv = () => {
    const rows: (string | number)[][] = [byTask ? ["Customer", "Project", "Task", "Code", "Hours", "Billable hours", "Entries"] : ["Customer", "Project", "Hours", "Billable hours", "Entries"]];
    for (const g of groups) {
      if (!byTask) rows.push([g.customer, g.project, hrs(g.total), hrs(g.billable), g.n]);
      else for (const t of Array.from(g.tasks.values())) rows.push([g.customer, g.project, t.name, t.code, hrs(t.total), hrs(t.billable), t.n]);
    }
    download(byTask ? "time-by-project-and-task.csv" : "time-by-project.csv", rows);
  };

  return (
    <section data-testid="project-report" className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Time per project</h2>
          <p className="text-xs text-muted-foreground">Follows the period, person and customer filters above.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={byTask} onChange={(e) => setByTask(e.target.checked)} className="accent-[hsl(var(--primary))]" />
            Break down by task
          </label>
          <CsvButton onClick={exportCsv} label="Download project report as CSV" />
        </div>
      </div>
      <div className="stack-table-wrap m3-scroll overflow-auto">
        <table className="stack-table w-full min-w-[40rem] border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground">
              <th>Customer</th><th>Project</th>{byTask && <><th>Task</th><th>Code</th></>}
              <th className="text-right">Hours</th><th className="text-right">Billable</th><th className="text-right">Entries</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-border/70">
            {groups.flatMap((g) => {
              const head = (
                <tr key={g.key} className={cn(byTask && "bg-primary/[0.06] font-semibold")} data-testid="project-row">
                  <td data-label="Customer" className="px-3 py-2.5 font-medium">{g.customer}</td>
                  <td data-label="Project" className="px-3 py-2.5">{g.project}</td>
                  {byTask && <><td className="px-3 py-2.5 text-muted-foreground">All tasks</td><td className="px-3 py-2.5" /></>}
                  <td data-label="Hours" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(g.total)}</td>
                  <td data-label="Billable" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(g.billable)}</td>
                  <td data-label="Entries" className="px-3 py-2.5 text-right text-xs text-muted-foreground">{g.n}</td>
                </tr>
              );
              if (!byTask) return [head];
              return [
                head,
                ...Array.from(g.tasks.values())
                  .sort((a, b) => b.total - a.total)
                  .map((t) => (
                    <tr key={`${g.key}-${t.id}`} data-testid="task-row">
                      <td className="px-3 py-2" /><td className="px-3 py-2 pl-6 text-muted-foreground">↳</td>
                      <td data-label="Task" className="px-3 py-2">{t.name}</td>
                      <td data-label="Code" className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.code}</td>
                      <td data-label="Hours" className="px-3 py-2 text-right font-mono tabular-nums">{hrs(t.total)}</td>
                      <td data-label="Billable" className="px-3 py-2 text-right font-mono tabular-nums">{hrs(t.billable)}</td>
                      <td data-label="Entries" className="px-3 py-2 text-right text-xs text-muted-foreground">{t.n}</td>
                    </tr>
                  )),
              ];
            })}
            {groups.length === 0 && <tr className="group-row"><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No time in this period.</td></tr>}
          </tbody>
          {groups.length > 0 && (
            <tfoot>
              <tr className="font-semibold [&_td]:bg-surface-container">
                <td className="px-3 py-2.5" colSpan={byTask ? 4 : 2}>Total</td>
                <td data-testid="project-total" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(total)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(billable)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

type Grain = "day" | "week" | "month";
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString([], { month: "short", year: "numeric" });
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

/** Hours per person per day / week / month, as a grid. */
export function PersonTimeReport({ entries }: { entries: TimeEntryItem[] }) {
  const [grain, setGrain] = useState<Grain>("week");
  const keyOf = (d: string) => (grain === "day" ? d : grain === "week" ? weekStart(d) : d.slice(0, 7));
  const labelOf = (k: string) => (grain === "day" ? dayLabel(k) : grain === "week" ? weekRangeLabel(k) : monthLabel(k));

  const { cols, rows, colTotals, grand } = useMemo(() => {
    const colSet = new Set<string>();
    const people = new Map<string, { id: string; name: string; byCol: Map<string, number>; total: number }>();
    const colTotals = new Map<string, number>();
    let grand = 0;
    for (const e of entries) {
      const k = keyOf(e.date);
      colSet.add(k);
      const p = people.get(e.userId) ?? { id: e.userId, name: e.userName, byCol: new Map(), total: 0 };
      p.byCol.set(k, (p.byCol.get(k) ?? 0) + e.durationMinutes);
      p.total += e.durationMinutes;
      people.set(e.userId, p);
      colTotals.set(k, (colTotals.get(k) ?? 0) + e.durationMinutes);
      grand += e.durationMinutes;
    }
    return { cols: Array.from(colSet).sort(), rows: Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name)), colTotals, grand };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, grain]);

  const exportCsv = () => {
    const out: (string | number)[][] = [["Person", ...cols.map(labelOf), "Total"]];
    for (const r of rows) out.push([r.name, ...cols.map((c) => (r.byCol.has(c) ? hrs(r.byCol.get(c)!) : "")), hrs(r.total)]);
    out.push(["Total", ...cols.map((c) => hrs(colTotals.get(c) ?? 0)), hrs(grand)]);
    download(`hours-per-person-by-${grain}.csv`, out);
  };

  return (
    <section data-testid="person-time-report" className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Time per person, per {grain}</h2>
          <p className="text-xs text-muted-foreground">Follows the period, person and customer filters above.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-36">
            <Dropdown
              aria-label="Group time by"
              value={grain}
              onChange={(v) => setGrain(v as Grain)}
              options={[{ value: "day", label: "By day" }, { value: "week", label: "By week" }, { value: "month", label: "By month" }]}
            />
          </div>
          <CsvButton onClick={exportCsv} label="Download person report as CSV" />
        </div>
      </div>
      <div className="m3-scroll overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr>
              <th className={cn(th, "sticky left-0 z-10 min-w-[10rem]")}>Person</th>
              {cols.map((c) => <th key={c} className={cn(th, "whitespace-nowrap text-right")}>{labelOf(c)}</th>)}
              <th className={cn(th, "text-right")}>Total</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-border/70">
            {rows.map((r) => (
              <tr key={r.id} data-testid="person-row">
                <td className="sticky left-0 bg-card px-3 py-2.5 font-medium">{r.name}</td>
                {cols.map((c) => (
                  <td key={c} data-col={c} className="px-3 py-2.5 text-right font-mono tabular-nums">{r.byCol.has(c) ? hrs(r.byCol.get(c)!) : <span className="text-muted-foreground/40">–</span>}</td>
                ))}
                <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{hrs(r.total)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length + 2} className="py-12 text-center text-sm text-muted-foreground">No time in this period.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-semibold [&_td]:bg-surface-container">
                <td className="sticky left-0 bg-surface-container px-3 py-2.5">Total</td>
                {cols.map((c) => <td key={c} className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(colTotals.get(c) ?? 0)}</td>)}
                <td data-testid="person-grand-total" className="px-3 py-2.5 text-right font-mono tabular-nums">{hrs(grand)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
