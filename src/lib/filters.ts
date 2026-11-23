import type { TimeEntryItem } from "@/db/mock-data";

export type Billable = "all" | "billable" | "non-billable";

/** Everything you can narrow a list of time entries by. Empty string / "all" = no restriction. */
export interface EntryFilters {
  customer: string; // customer id
  project: string; // job id
  task: string; // service item id
  billable: Billable;
  location: string; // locationType
  status: string; // draft | submitted | approved | exported | flagged
  from: string; // yyyy-mm-dd
  to: string;
}

export const NO_FILTERS: EntryFilters = { customer: "", project: "", task: "", billable: "all", location: "", status: "", from: "", to: "" };

export function matchesFilters(e: TimeEntryItem, f: EntryFilters): boolean {
  if (f.customer && e.customerId !== f.customer) return false;
  if (f.project && e.jobId !== f.project) return false;
  if (f.task && e.serviceItemId !== f.task) return false;
  if (f.billable === "billable" && !e.isBillable) return false;
  if (f.billable === "non-billable" && e.isBillable) return false;
  if (f.location && e.locationType !== f.location) return false;
  if (f.status === "flagged" ? !e.flagged : f.status && e.status !== f.status) return false;
  if (f.from && e.date < f.from) return false;
  if (f.to && e.date > f.to) return false;
  return true;
}

export function activeFilterCount(f: EntryFilters): number {
  return (Object.keys(NO_FILTERS) as (keyof EntryFilters)[]).filter((k) => f[k] !== NO_FILTERS[k]).length;
}

export const locationLabel = (t: string) => (t === "on_site" ? "On site" : t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " "));
