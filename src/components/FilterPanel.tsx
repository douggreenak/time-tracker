"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { Dropdown } from "@/components/ui/dropdown";
import { type EntryFilters, NO_FILTERS, locationLabel } from "@/lib/filters";

export type FilterField = keyof EntryFilters;

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "exported", label: "Exported" },
  { value: "flagged", label: "Flagged" },
];

/**
 * A row of dropdowns / date boxes that narrow a list of time entries. Options come from the entries
 * themselves, so every choice is guaranteed to match something. `fields` picks which controls to show.
 */
export function FilterPanel({
  entries,
  value,
  onChange,
  fields,
  customerId,
  label = "Filters",
}: {
  entries: TimeEntryItem[];
  value: EntryFilters;
  onChange: (next: EntryFilters) => void;
  fields: FilterField[];
  /** Restricts the project list to one customer. */
  customerId?: string;
  label?: string;
}) {
  const opts = useMemo(() => {
    const customers = new Map<string, string>();
    const projects = new Map<string, string>();
    const tasks = new Map<string, string>();
    const locations = new Set<string>();
    for (const e of entries) {
      if (e.customerId) customers.set(e.customerId, e.customerName);
      if (e.jobId && (!(customerId || value.customer) || e.customerId === (customerId || value.customer))) projects.set(e.jobId, e.jobName ?? "");
      if (e.serviceItemId) tasks.set(e.serviceItemId, e.serviceItemName);
      locations.add(e.locationType);
    }
    const sorted = (m: Map<string, string>) => Array.from(m, ([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label));
    return { customers: sorted(customers), projects: sorted(projects), tasks: sorted(tasks), locations: Array.from(locations).sort() };
  }, [entries, customerId, value.customer]);

  const set = (patch: Partial<EntryFilters>) => onChange({ ...value, ...patch });
  const has = (f: FilterField) => fields.includes(f);
  const n = fields.filter((f) => value[f] !== NO_FILTERS[f]).length;

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-end gap-2">
      {has("customer") && (
        <Field label="Customer">
          <Dropdown aria-label="Filter customer" value={value.customer} onChange={(v) => set({ customer: v, project: "" })} options={[{ value: "", label: "All customers" }, ...opts.customers]} />
        </Field>
      )}
      {has("project") && (
        <Field label="Project">
          <Dropdown aria-label="Filter project" value={value.project} onChange={(v) => set({ project: v })} options={[{ value: "", label: "All projects" }, ...opts.projects]} />
        </Field>
      )}
      {has("task") && (
        <Field label="Task">
          <Dropdown aria-label="Filter task" value={value.task} onChange={(v) => set({ task: v })} options={[{ value: "", label: "All tasks" }, ...opts.tasks]} />
        </Field>
      )}
      {has("billable") && (
        <Field label="Billing">
          <Dropdown
            aria-label="Filter billable"
            value={value.billable}
            onChange={(v) => set({ billable: v as EntryFilters["billable"] })}
            options={[{ value: "all", label: "Billable & not" }, { value: "billable", label: "Billable only" }, { value: "non-billable", label: "Non-billable only" }]}
          />
        </Field>
      )}
      {has("location") && (
        <Field label="Location">
          <Dropdown aria-label="Filter location" value={value.location} onChange={(v) => set({ location: v })} options={[{ value: "", label: "Any location" }, ...opts.locations.map((l) => ({ value: l, label: locationLabel(l) }))]} />
        </Field>
      )}
      {has("status") && (
        <Field label="Status">
          <Dropdown aria-label="Filter status" value={value.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} />
        </Field>
      )}
      {has("from") && (
        <Field label="From" narrow>
          <input type="date" aria-label="Filter from date" value={value.from} onChange={(e) => set({ from: e.target.value })} className="h-9 w-full rounded-full border border-outline-variant bg-surface-low px-3 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25" />
        </Field>
      )}
      {has("to") && (
        <Field label="To" narrow>
          <input type="date" aria-label="Filter to date" value={value.to} onChange={(e) => set({ to: e.target.value })} className="h-9 w-full rounded-full border border-outline-variant bg-surface-low px-3 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25" />
        </Field>
      )}
      {n > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...value, ...Object.fromEntries(fields.map((f) => [f, NO_FILTERS[f]])) })}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-primary transition hover:bg-primary/10"
        >
          <X className="h-3.5 w-3.5" />Clear filters ({n})
        </button>
      )}
    </div>
  );
}

function Field({ label, narrow, children }: { label: string; narrow?: boolean; children: React.ReactNode }) {
  return (
    <div className={narrow ? "w-36" : "w-44"}>
      <div className="m3-label mb-1">{label}</div>
      {children}
    </div>
  );
}
