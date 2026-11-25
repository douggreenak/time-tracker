/**
 * Invoice sheets, built the way the workbook's macro builds them: for a date range, one sheet per customer
 * with a labor table (DATE, CUSTOMER, HOURS, TASK, PERSONNEL, RATE, TOTAL), a PARTS table, and a SUMMARY.
 * Pure functions, so the screen, the server and the Excel export all agree on the numbers.
 */
import type { TimeEntryItem, UserItem } from "@/db/mock-data";

export interface InvoiceLine {
  entryId: string;
  date: string;
  customer: string;
  hours: number;
  task: string;
  personnel: string;
  rate: number;
  total: number;
  isLumpSum: boolean;
  partsNote: string;
}

export interface PartRow {
  item: string;
  qty: number;
  desc: string;
  unitCost: number;
}

export interface PersonSummary {
  personnel: string;
  hours: number;
  total: number;
}

export interface InvoiceData {
  customerId: string;
  customerName: string;
  dateFrom: string;
  dateTo: string;
  lines: InvoiceLine[];
  parts: PartRow[];
  summary: PersonSummary[];
  laborTotal: number;
  partsTotal: number;
  amountDue: number;
  entryIds: string[];
}

/** Money to the cent; hours to the tenth (like the sheet's 0.0 format). */
export const cents = (n: number) => Math.round(n * 100) / 100;
export const tenths = (minutes: number) => Math.round(minutes / 6) / 10;
export const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Names appear on invoices in capitals, like JEFF GREEN in the workbook. */
export const personnelName = (n: string) => n.trim().toUpperCase();

/** What counts for an invoice: billable, not held, and (unless asked) not already invoiced. */
export function billableEntries(entries: TimeEntryItem[], opts: { includeInvoiced?: boolean } = {}) {
  return entries.filter((e) => e.isBillable && !e.isHeld && (opts.includeInvoiced || !e.isInvoiced));
}

export function blankPart(): PartRow {
  return { item: "", qty: 1, desc: "", unitCost: 0 };
}

export const partTotal = (p: PartRow) => cents((Number(p.qty) || 0) * (Number(p.unitCost) || 0));

/** Rebuilds the totals after parts rows change. */
export function withParts(inv: InvoiceData, parts: PartRow[]): InvoiceData {
  const kept = parts.filter((p) => p.item.trim() || p.desc.trim() || Number(p.unitCost));
  const partsTotal = cents(kept.reduce((n, p) => n + partTotal(p), 0));
  return { ...inv, parts: kept, partsTotal, amountDue: cents(inv.laborTotal + partsTotal) };
}

/** The billing rate for a person on a given day (honours rate changes that only apply going forward). */
export function rateAt(u: Pick<UserItem, "defaultHourlyRate" | "rateHistory"> | undefined, date: string): number {
  if (!u) return 0;
  const old = [...(u.rateHistory ?? [])].sort((a, b) => a.until.localeCompare(b.until)).find((h) => date <= h.until);
  return Number(old ? old.rate : u.defaultHourlyRate) || 0;
}

export function buildInvoice(
  entries: TimeEntryItem[],
  users: UserItem[],
  customer: { id: string; name: string },
  dateFrom: string,
  dateTo: string,
  parts: PartRow[] = []
): InvoiceData {
  const userOf = new Map(users.map((u) => [u.id, u]));
  const mine = entries
    .filter((e) => e.customerId === customer.id && e.date >= dateFrom && e.date <= dateTo)
    // by person, then by date, as the macro walks each person's sheet in order
    .sort((a, b) => a.userName.localeCompare(b.userName) || a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const lines: InvoiceLine[] = mine.map((e) => {
    const hours = tenths(e.durationMinutes);
    const rate = rateAt(userOf.get(e.userId), e.date);
    return {
      entryId: e.id,
      date: e.date,
      customer: customer.name,
      hours,
      task: e.notes ?? "",
      personnel: personnelName(e.userName),
      rate,
      // A lump-sum day is priced from the Lump Sum list, not hours x rate.
      total: e.isLumpSum ? 0 : cents(hours * rate),
      isLumpSum: e.isLumpSum,
      partsNote: e.partsNote ?? "",
    };
  });

  const byPerson = new Map<string, PersonSummary>();
  for (const l of lines) {
    const s = byPerson.get(l.personnel) ?? { personnel: l.personnel, hours: 0, total: 0 };
    s.hours = cents(s.hours + l.hours);
    s.total = cents(s.total + l.total);
    byPerson.set(l.personnel, s);
  }
  const summary = Array.from(byPerson.values());
  const laborTotal = cents(summary.reduce((n, s) => n + s.total, 0));
  return withParts(
    {
      customerId: customer.id,
      customerName: customer.name,
      dateFrom,
      dateTo,
      lines,
      parts: [],
      summary,
      laborTotal,
      partsTotal: 0,
      amountDue: laborTotal,
      entryIds: lines.map((l) => l.entryId),
    },
    parts
  );
}

/** Excel sheet names: no \ / * ? : [ ], at most 31 characters, and unique within the workbook. */
export function sheetName(name: string, taken: Set<string>) {
  const base = (name.replace(/[\\/*?:[\]]/g, "").trim() || "Invoice").slice(0, 31);
  let out = base;
  for (let i = 2; taken.has(out.toLowerCase()); i++) out = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
  taken.add(out.toLowerCase());
  return out;
}
