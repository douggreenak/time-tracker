import workbook from "./workbook-demo.json";

/** Types shared by the API and the screens, plus the demo data (built from the Apex billing workbook). */

export interface CustomerItem {
  id: string;
  name: string;
  isActive: boolean;
  /** End date of the most recent invoice made for this customer (the workbook's MACRO DATA sheet). */
  lastInvoiceDate?: string | null;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "engineer" | "accountant" | "admin";
  /** What this person is billed out at, per hour (the workbook's RATE). */
  defaultHourlyRate: number;
  /** Earlier rates: time dated on or before `until` is billed at `rate` (set when a rate change only applies going forward). */
  rateHistory?: { until: string; rate: number }[];
}

/** One row of the workbook's TIME SUMMARY sheets. */
export interface TimeEntryItem {
  id: string;
  userId: string;
  userName: string;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number; // always a whole number of tenths of an hour (6 minutes)
  /** The workbook's DESCRIPTION column. */
  notes?: string | null;
  isLumpSum: boolean;
  /** What parts were used (and their prices). Anything here means the entry has parts. */
  partsNote?: string | null;
  /** Private comment, like the cell comments in the workbook. */
  internalNote?: string | null;
  contractPo?: string | null;
  isBillable: boolean;
  isInvoiced: boolean;
  invoicedOn?: string | null;
  /** Held time: worked but not billed yet, so it stays out of invoices. */
  isHeld: boolean;
  createdAt: string;
}

export interface BillingItem {
  id: string;
  kind: "lump_sum" | "other";
  customer: string;
  description: string;
  amount: number;
  notes: string;
}

export interface InvoiceRecord {
  id: string;
  customerId: string | null;
  customerName: string;
  dateFrom: string;
  dateTo: string;
  total: number;
  createdBy: string | null;
  createdAt: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export const initialUsers: UserItem[] = [
  { id: "usr_jeff", name: "Jeff Green", email: "jeff.green@example.com", role: "engineer", defaultHourlyRate: 250 },
  { id: "usr_doug", name: "Doug Green", email: "doug.green@example.com", role: "admin", defaultHourlyRate: 250 },
  { id: "usr_molly", name: "Molly Green", email: "molly.green@example.com", role: "accountant", defaultHourlyRate: 250 },
  { id: "usr_others", name: "Others", email: "others@example.com", role: "engineer", defaultHourlyRate: 250 },
];

const userIdByName = new Map(initialUsers.map((u) => [u.name, u.id]));
export const customerIdOf = (name: string) => `cust_${slug(name)}`;

export const initialCustomers: CustomerItem[] = workbook.customers.map((name) => ({ id: customerIdOf(name), name, isActive: true }));

/** Time before this date is treated as already invoiced in the demo (the last run was 12 Nov 2026). */
export const DEMO_LAST_RUN = "2026-11-12";

const entryBase = { isHeld: false, createdAt: "2026-11-20T12:00:00.000Z" };

export const initialTimeEntries: TimeEntryItem[] = [
  ...workbook.entries.map((e, i): TimeEntryItem => ({
    ...entryBase,
    id: `ent_${i + 1}`,
    userId: userIdByName.get(e.person) ?? "usr_jeff",
    userName: e.person,
    customerId: customerIdOf(e.customer),
    customerName: e.customer,
    date: e.date,
    durationMinutes: Math.round(e.hours * 60),
    notes: e.description,
    isLumpSum: e.lumpSum,
    partsNote: e.partsNote || (e.hasParts ? "See notes" : ""),
    internalNote: e.internalNote,
    contractPo: e.contractPo,
    isBillable: e.billable,
    isInvoiced: e.invoiced || (e.billable && e.date <= DEMO_LAST_RUN),
    invoicedOn: e.invoiced || (e.billable && e.date <= DEMO_LAST_RUN) ? DEMO_LAST_RUN : null,
  })),
  // HELD TIME sheet
  ...workbook.held.map((h, i): TimeEntryItem => ({
    ...entryBase,
    id: `held_${i + 1}`,
    userId: "usr_jeff",
    userName: "Jeff Green",
    customerId: customerIdOf(h.customer),
    customerName: h.customer,
    date: h.date,
    durationMinutes: Math.round(h.hours * 60),
    notes: h.description,
    isLumpSum: false,
    partsNote: h.partsNote,
    internalNote: h.internalNote,
    contractPo: "",
    isBillable: true,
    isInvoiced: false,
    invoicedOn: null,
    isHeld: true,
  })),
];

/** LUMP SUM and OTHER sheets. */
export const initialBillingItems: BillingItem[] = [
  ...workbook.lumpSum.map((x, i): BillingItem => ({ id: `lump_${i + 1}`, kind: "lump_sum", ...x })),
  ...workbook.other.map((x, i): BillingItem => ({ id: `other_${i + 1}`, kind: "other", ...x })),
];
