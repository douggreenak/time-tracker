"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Building2, FolderKanban, Plus, Search, Trash2, AlertCircle, X } from "lucide-react";
import type { CustomerItem, TimeEntryItem } from "@/db/mock-data";
import { TextCell, cellBase } from "@/components/ui/cell";
import { RequireManager } from "@/components/AuthProvider";
import { useDirectory } from "@/lib/useDirectory";
import { cn } from "@/components/ui";

const hours = (min: number) => (min / 60).toFixed(2);

function CustomersPage() {
  const dir = useDirectory();
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newProject, setNewProject] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refreshEntries = () =>
    fetch("/api/time-entries")
      .then((r) => r.json())
      .then((j) => j.success && setEntries(j.data))
      .catch(() => {});
  useEffect(() => {
    refreshEntries();
  }, []);

  const minutesBy = useMemo(() => {
    const byCust = new Map<string, number>();
    const byJob = new Map<string, number>();
    for (const e of entries) {
      byCust.set(e.customerId, (byCust.get(e.customerId) ?? 0) + e.durationMinutes);
      if (e.jobId) byJob.set(e.jobId, (byJob.get(e.jobId) ?? 0) + e.durationMinutes);
    }
    return { byCust, byJob };
  }, [entries]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dir.customers
      .filter((c) => (showArchived ? true : c.isActive))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.jobs.some((j) => j.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dir.customers, query, showArchived]);

  const selected: CustomerItem | undefined = dir.customers.find((c) => c.id === selectedId) ?? list[0];

  const run = async <T,>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>) => {
    const r = await p;
    if (!r.ok) setError(r.error);
    else setError(null);
    return r;
  };

  const addCustomer = async () => {
    const name = newCustomer.trim();
    if (!name) return;
    if (dir.customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) return setError(`“${name}” already exists.`);
    const r = await run(dir.createCustomer(name));
    if (r.ok) {
      setNewCustomer("");
      setSelectedId(r.data.id);
      setTimeout(() => document.getElementById("new-project")?.focus(), 0);
    }
  };

  const addProject = async () => {
    const name = newProject.trim();
    if (!name || !selected) return;
    if (selected.jobs.some((j) => j.name.toLowerCase() === name.toLowerCase())) return setError(`“${name}” already exists for ${selected.name}.`);
    const r = await run(dir.createJob(selected.id, name));
    if (r.ok) setNewProject("");
  };

  const confirmDelete = async (what: string, fn: () => Promise<unknown>) => {
    if (confirm(`Delete ${what}? This can't be undone.`)) await fn();
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Customers &amp; projects</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          These feed the dropdowns on the timesheet and the QuickBooks <span className="font-mono">Customer:Job</span> names on export.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex animate-m3-rise items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid min-h-[calc(100dvh-13rem)] gap-4 lg:grid-cols-[22rem_1fr]">
        {/* Customers list */}
        <aside className="flex max-h-80 min-h-0 flex-col overflow-hidden rounded-[14px] lg:max-h-none border border-border/70 bg-card shadow-sm">
          <div className="space-y-2 border-b border-border/70 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customers & projects…"
                aria-label="Search customers"
                className="h-9 w-full rounded-full border border-outline-variant bg-surface-low pl-8 pr-3 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addCustomer();
              }}
              className="flex gap-2"
            >
              <input
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="New customer name…"
                aria-label="New customer name"
                className="h-9 min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-low px-4 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
              <button
                type="submit"
                aria-label="Add customer"
                disabled={!newCustomer.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>

          <ul className="m3-scroll min-h-0 flex-1 divide-y divide-border/60 overflow-auto" role="listbox" aria-label="Customers">
            {list.map((c) => {
              const active = c.id === selected?.id;
              return (
                <li key={c.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      active ? "bg-primary/10" : "hover:bg-foreground/[0.04]",
                      !c.isActive && "opacity-60"
                    )}
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-surface-container text-muted-foreground")}>
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {c.jobs.length} project{c.jobs.length === 1 ? "" : "s"} · {hours(minutesBy.byCust.get(c.id) ?? 0)}h{!c.isActive && " · archived"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-4 py-10 text-center text-xs text-muted-foreground">No customers match.</li>}
          </ul>
          <label className="flex cursor-pointer items-center gap-2 border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[hsl(var(--primary))]" />
            Show archived
          </label>
        </aside>

        {/* Customer detail */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-border/70 bg-card shadow-sm">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">Add a customer to get started.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border/70 p-4">
                <div className="min-w-[14rem] flex-1">
                  <div className="m3-label mb-1">Customer name</div>
                  <div className="rounded-lg border border-outline-variant bg-surface-low focus-within:border-primary">
                    <TextCell aria-label="Customer name" value={selected.name} onCommit={(v) => v.trim() && run(dir.updateCustomer(selected.id, { name: v.trim() }))} className="h-10 text-sm font-semibold" />
                  </div>
                </div>
                <div className="min-w-[14rem] flex-1">
                  <div className="m3-label mb-1">QuickBooks name</div>
                  <div className="rounded-lg border border-outline-variant bg-surface-low focus-within:border-primary">
                    <TextCell aria-label="QuickBooks name" value={selected.qbName} onCommit={(v) => v.trim() && run(dir.updateCustomer(selected.id, { qbName: v.trim() }))} className="h-10 font-mono text-xs" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => run(dir.updateCustomer(selected.id, { isActive: !selected.isActive }))}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold transition-colors hover:bg-foreground/[0.05]"
                  >
                    {selected.isActive ? <><Archive className="h-3.5 w-3.5" />Archive</> : <><ArchiveRestore className="h-3.5 w-3.5" />Restore</>}
                  </button>
                  <button
                    onClick={() => confirmDelete(`“${selected.name}”`, async () => { const r = await run(dir.deleteCustomer(selected.id)); if (r.ok) setSelectedId(""); })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </button>
                </div>
              </div>

              <div className="stack-table-wrap m3-scroll min-h-0 flex-1 overflow-auto">
                <table className="stack-table w-full border-separate border-spacing-0 text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                      <th className="w-full"><span className="inline-flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5" />Project</span></th>
                      <th className="min-w-[16rem]">QuickBooks job</th>
                      <th className="w-24 text-right">Hours</th>
                      <th className="w-28">Status</th>
                      <th className="w-24" />
                    </tr>
                  </thead>
                  <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
                    <tr className="bg-primary-container/40">
                      <td data-label="Project" className="span-2">
                        <input
                          id="new-project"
                          value={newProject}
                          onChange={(e) => setNewProject(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addProject()}
                          aria-label="New project name"
                          placeholder="New project — type a name and press Enter"
                          className={cellBase}
                        />
                      </td>
                      <td data-label="QuickBooks job" className="px-2 font-mono text-[11px] text-muted-foreground span-2">{newProject.trim() ? `${selected.qbName}:${newProject.trim()}` : ""}</td>
                      <td />
                      <td className="px-2 text-[11px] font-medium text-primary">New row</td>
                      <td className="text-center">
                        <button onClick={addProject} aria-label="Add project" disabled={!newProject.trim()} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40">
                          <Plus className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {selected.jobs.map((j) => (
                      <tr key={j.id} className={cn("group bg-card hover:bg-surface-low", !j.isActive && "opacity-60")}>
                        <td data-label="Project" className="span-2"><TextCell aria-label="Project name" value={j.name} onCommit={(v) => v.trim() && run(dir.updateJob(j.id, { name: v.trim() }))} /></td>
                        <td data-label="QuickBooks job" className="px-2 font-mono text-[11px] text-muted-foreground span-2 text-xs">{j.fullQbJobName}</td>
                        <td data-label="Hours" className="px-2 text-right font-mono text-[13px] tabular-nums">{hours(minutesBy.byJob.get(j.id) ?? 0)}</td>
                        <td data-label="Status" className="px-2">
                          <button
                            onClick={() => run(dir.updateJob(j.id, { isActive: !j.isActive }))}
                            className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", j.isActive ? "bg-tertiary-container text-tertiary-on-container" : "bg-surface-high text-muted-foreground")}
                          >
                            {j.isActive ? "Active" : "Archived"}
                          </button>
                        </td>
                        <td className="text-center actions-cell">
                          <button
                            onClick={() => confirmDelete(`“${j.name}”`, () => run(dir.deleteJob(j.id)))}
                            aria-label={`Delete ${j.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {selected.jobs.length === 0 && (
                      <tr className="group-row"><td colSpan={5} className="py-10 text-center text-xs text-muted-foreground">No projects yet — jobs for this customer are created by typing above.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
                Customers or projects with logged time can&apos;t be deleted — archive them to hide them from the timesheet dropdowns. Edits save when you leave a cell.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireManager>
      <CustomersPage />
    </RequireManager>
  );
}
