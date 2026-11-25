import { createHash } from "node:crypto";
import * as schema from "./schema";
import type { Db } from "./client";
import { hashPassword } from "../lib/password";
import { DEMO_LAST_RUN, initialBillingItems, initialCustomers, initialTimeEntries, initialUsers } from "./mock-data";

/** Stable UUID for a sample record, e.g. seedId("user-1"). */
export function seedId(old: string): string {
  const h = createHash("sha1").update(`tt-seed:${old}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const DEMO_PASSWORD = "demo1234";

// Any drizzle executor (a db or a transaction); we only build statements and let the caller run them.
type Exec = Pick<Db, "insert" | "delete">;

/**
 * The statements that load the sample data. They are returned un-run so the caller can execute them
 * all-or-nothing (Neon batch / PGlite transaction). Fixed ids + "do nothing on conflict" make them repeatable.
 */
export function demoSeedStatements(db: Exec, demoHash: string) {
  const id = seedId;
  const out: PromiseLike<unknown>[] = [];
  const chunk = <T,>(rows: T[], n = 150) => Array.from({ length: Math.ceil(rows.length / n) }, (_, i) => rows.slice(i * n, i * n + n));

  out.push(db.insert(schema.users).values(
    initialUsers.map((u) => ({
      passwordHash: demoHash,
      id: id(u.id),
      name: u.name,
      email: u.email,
      role: u.role,
      qbEmployeeName: u.name,
      defaultHourlyRate: String(u.defaultHourlyRate),
    }))
  ).onConflictDoNothing());
  out.push(db.insert(schema.customers).values(
    initialCustomers.map((c) => ({ id: id(c.id), name: c.name, qbName: c.name, isActive: c.isActive }))
  ).onConflictDoNothing());
  for (const rows of chunk(initialTimeEntries))
    out.push(db.insert(schema.timeEntries).values(
      rows.map((e) => ({
        id: id(e.id),
        userId: id(e.userId),
        customerId: id(e.customerId),
        date: e.date,
        durationMinutes: e.durationMinutes,
        notes: e.notes ?? "",
        isLumpSum: e.isLumpSum,
        partsNote: e.partsNote ?? "",
        internalNote: e.internalNote ?? "",
        contractPo: e.contractPo ?? "",
        isBillable: e.isBillable,
        isInvoiced: e.isInvoiced,
        invoicedOn: e.invoicedOn ?? null,
        isHeld: e.isHeld,
        status: "draft",
        createdAt: new Date(e.createdAt),
      }))
    ).onConflictDoNothing());
  out.push(db.insert(schema.billingItems).values(
    initialBillingItems.map((b) => ({ id: id(b.id), kind: b.kind, customer: b.customer, description: b.description, amount: String(b.amount), notes: b.notes }))
  ).onConflictDoNothing());

  // Invoice history: one invoice per customer for everything the last run covered.
  const rate = new Map(initialUsers.map((u) => [u.id, u.defaultHourlyRate]));
  const byCustomer = new Map<string, { name: string; from: string; to: string; total: number }>();
  for (const e of initialTimeEntries) {
    if (!e.isInvoiced || e.isHeld || !e.isBillable) continue;
    const cur = byCustomer.get(e.customerId) ?? { name: e.customerName, from: e.date, to: e.date, total: 0 };
    cur.from = e.date < cur.from ? e.date : cur.from;
    cur.to = e.date > cur.to ? e.date : cur.to;
    cur.total += (e.durationMinutes / 60) * (rate.get(e.userId) ?? 250);
    byCustomer.set(e.customerId, cur);
  }
  const history = Array.from(byCustomer.entries()).map(([cid, v]) => ({
    id: id(`inv_${cid}`),
    customerId: id(cid),
    customerName: v.name,
    dateFrom: v.from,
    dateTo: v.to,
    total: v.total.toFixed(2),
    createdBy: "Jeff Green",
    createdAt: new Date(`${DEMO_LAST_RUN}T18:00:00Z`),
  }));
  if (history.length) out.push(db.insert(schema.invoices).values(history).onConflictDoNothing());
  return out;
}

/** Hash for the sample people's shared password. */
export const demoHash = () => hashPassword(DEMO_PASSWORD);
