import { dataStore } from "@/db/store";
import { checkDate } from "@/lib/validate";
import { billableEntries, buildInvoice, type InvoiceData, type PartRow } from "@/lib/invoice";

export interface BillingRequest {
  from: string;
  to: string;
  /** One entry per customer to invoice, with that invoice's parts rows. */
  customers: { id: string; parts?: PartRow[] }[];
  includeInvoiced?: boolean;
}

const cleanParts = (parts: unknown): PartRow[] =>
  (Array.isArray(parts) ? parts : []).slice(0, 200).map((p) => ({
    item: String(p?.item ?? "").slice(0, 255),
    qty: Number(p?.qty) || 0,
    desc: String(p?.desc ?? "").slice(0, 500),
    unitCost: Number(p?.unitCost) || 0,
  }));

/** Checks a billing request body; returns the parsed request or an error message. */
export function parseBillingRequest(body: unknown): { ok: true; req: BillingRequest } | { ok: false; error: string } {
  const b = (body ?? {}) as Partial<BillingRequest>;
  const bad = checkDate(b.from) || checkDate(b.to);
  if (bad) return { ok: false, error: bad };
  if ((b.from as string) > (b.to as string)) return { ok: false, error: "The start date is after the end date." };
  if (!Array.isArray(b.customers) || b.customers.length === 0) return { ok: false, error: "Pick at least one customer." };
  if (b.customers.length > 200) return { ok: false, error: "That's too many customers at once." };
  return {
    ok: true,
    req: {
      from: b.from as string,
      to: b.to as string,
      includeInvoiced: Boolean(b.includeInvoiced),
      customers: b.customers.map((c) => ({ id: String(c?.id ?? ""), parts: cleanParts(c?.parts) })),
    },
  };
}

/** Builds each customer's invoice from the database (never from numbers the browser sends). */
export async function buildInvoices(req: BillingRequest): Promise<InvoiceData[]> {
  const [entries, users, customers] = await Promise.all([
    dataStore.getTimeEntries({ startDate: req.from, endDate: req.to }),
    dataStore.getUsers(),
    dataStore.getCustomers(),
  ]);
  const usable = billableEntries(entries, { includeInvoiced: req.includeInvoiced });
  const out: InvoiceData[] = [];
  for (const c of req.customers) {
    const cust = customers.find((x) => x.id === c.id);
    if (!cust) continue;
    const inv = buildInvoice(usable, users, cust, req.from, req.to, c.parts ?? []);
    if (inv.lines.length) out.push(inv);
  }
  return out;
}
