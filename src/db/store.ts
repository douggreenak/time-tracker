import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { getDb } from "./client";
import * as t from "./schema";
import type { BillingItem, CustomerItem, InvoiceRecord, TimeEntryItem, UserItem } from "./mock-data";

export type DeleteResult = "ok" | "not_found" | "in_use";

const ci = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
// Postgres rejects malformed uuids; treat them as "not found" instead of a 500.
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
/** Hours are kept in tenths (6 minutes), like the workbook. */
export const toTenths = (minutes: number) => Math.round(Number(minutes) / 6) * 6;

const userOf = (r: typeof t.users.$inferSelect): UserItem => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role as UserItem["role"],
  defaultHourlyRate: Number(r.defaultHourlyRate ?? 250),
});

const entrySelect = {
  id: t.timeEntries.id,
  userId: t.timeEntries.userId,
  userName: t.users.name,
  customerId: t.timeEntries.customerId,
  customerName: t.customers.name,
  date: t.timeEntries.date,
  durationMinutes: t.timeEntries.durationMinutes,
  notes: t.timeEntries.notes,
  isLumpSum: t.timeEntries.isLumpSum,
  partsNote: t.timeEntries.partsNote,
  internalNote: t.timeEntries.internalNote,
  contractPo: t.timeEntries.contractPo,
  isBillable: t.timeEntries.isBillable,
  isInvoiced: t.timeEntries.isInvoiced,
  invoicedOn: t.timeEntries.invoicedOn,
  isHeld: t.timeEntries.isHeld,
  createdAt: t.timeEntries.createdAt,
};

type EntryRow = Awaited<ReturnType<typeof entryQuery>>[number];

// Customer is optional: "" means none.
const entryOf = (r: EntryRow): TimeEntryItem => ({
  ...r,
  customerId: r.customerId ?? "",
  customerName: r.customerName ?? "",
  createdAt: r.createdAt.toISOString(),
});

async function entryQuery(where?: SQL) {
  const db = await getDb();
  return db
    .select(entrySelect)
    .from(t.timeEntries)
    .innerJoin(t.users, eq(t.timeEntries.userId, t.users.id))
    .leftJoin(t.customers, eq(t.timeEntries.customerId, t.customers.id))
    .where(where)
    .orderBy(desc(t.timeEntries.date), desc(t.timeEntries.createdAt));
}

const billingItemOf = (r: typeof t.billingItems.$inferSelect): BillingItem => ({
  id: r.id,
  kind: r.kind as BillingItem["kind"],
  customer: r.customer,
  description: r.description,
  amount: Number(r.amount),
  notes: r.notes ?? "",
});

const invoiceOf = (r: typeof t.invoices.$inferSelect): InvoiceRecord => ({
  id: r.id,
  customerId: r.customerId,
  customerName: r.customerName,
  dateFrom: r.dateFrom,
  dateTo: r.dateTo,
  total: Number(r.total),
  createdBy: r.createdBy,
  createdAt: r.createdAt.toISOString(),
});

export interface EntryFields {
  customerId?: string | null;
  date?: string;
  durationMinutes?: number;
  notes?: string | null;
  isLumpSum?: boolean;
  partsNote?: string | null;
  internalNote?: string | null;
  contractPo?: string | null;
  isBillable?: boolean;
  isInvoiced?: boolean;
  isHeld?: boolean;
  userId?: string;
}

export const dataStore = {
  // ───────── Users ─────────
  getUsers: async (): Promise<UserItem[]> => {
    const db = await getDb();
    return (await db.select().from(t.users).orderBy(asc(t.users.name))).map(userOf);
  },
  getUserById: async (id: string) => {
    if (!isUuid(id)) return undefined;
    const db = await getDb();
    const [r] = await db.select().from(t.users).where(eq(t.users.id, id));
    return r ? userOf(r) : undefined;
  },
  /** For sign-in only: includes the password hash, which never leaves the server. */
  getUserForAuth: async (id: string) => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const [r] = await db.select().from(t.users).where(eq(t.users.id, id));
    return r ? { user: userOf(r), passwordHash: r.passwordHash } : null;
  },
  setPassword: async (id: string, passwordHash: string) => {
    if (!isUuid(id)) return false;
    const db = await getDb();
    const r = await db.update(t.users).set({ passwordHash }).where(eq(t.users.id, id)).returning({ id: t.users.id });
    return r.length > 0;
  },
  addUser: async (u: { name: string; email: string; role?: string; defaultHourlyRate?: number; passwordHash?: string }) => {
    const db = await getDb();
    const [r] = await db
      .insert(t.users)
      .values({
        name: u.name,
        email: u.email.trim().toLowerCase(), // emails are always stored in lowercase
        role: u.role || "engineer",
        qbEmployeeName: u.name,
        defaultHourlyRate: String(u.defaultHourlyRate ?? 250),
        passwordHash: u.passwordHash ?? null,
      })
      .returning();
    return userOf(r);
  },
  updateUser: async (id: string, u: { name?: string; email?: string; role?: string; defaultHourlyRate?: number }) => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const set: Partial<typeof t.users.$inferInsert> = {};
    if (u.name !== undefined) set.name = u.name;
    if (u.email !== undefined) set.email = u.email.trim().toLowerCase();
    if (u.role !== undefined) set.role = u.role;
    if (u.defaultHourlyRate !== undefined) set.defaultHourlyRate = String(u.defaultHourlyRate);
    if (Object.keys(set).length === 0) return dataStore.getUserById(id).then((x) => x ?? null);
    const [r] = await db.update(t.users).set(set).where(eq(t.users.id, id)).returning();
    return r ? userOf(r) : null;
  },
  deleteUser: async (id: string): Promise<DeleteResult> => {
    if (!isUuid(id)) return "not_found";
    const db = await getDb();
    if (!(await dataStore.getUserById(id))) return "not_found";
    const used = await db.select({ id: t.timeEntries.id }).from(t.timeEntries).where(eq(t.timeEntries.userId, id)).limit(1);
    if (used.length) return "in_use";
    await db.delete(t.users).where(eq(t.users.id, id));
    return "ok";
  },

  // ───────── Customers ─────────
  getCustomers: async (): Promise<CustomerItem[]> => {
    const db = await getDb();
    const [cs, last] = await Promise.all([
      db.select().from(t.customers).orderBy(asc(t.customers.name)),
      db
        .select({ id: t.invoices.customerId, last: sql<string>`max(${t.invoices.dateTo})` })
        .from(t.invoices)
        .groupBy(t.invoices.customerId),
    ]);
    const lastBy = new Map(last.map((l) => [l.id, l.last]));
    return cs.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive, lastInvoiceDate: lastBy.get(c.id) ?? null }));
  },
  addCustomer: async (name: string): Promise<CustomerItem> => {
    const existing = (await dataStore.getCustomers()).find((c) => ci(c.name, name));
    if (existing) return existing; // double-submit / create-on-type safe
    const db = await getDb();
    const [c] = await db.insert(t.customers).values({ name, qbName: name }).returning();
    return { id: c.id, name: c.name, isActive: c.isActive, lastInvoiceDate: null };
  },
  updateCustomer: async (id: string, u: { name?: string; isActive?: boolean }): Promise<CustomerItem | null> => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const set: Partial<typeof t.customers.$inferInsert> = {};
    if (u.name !== undefined) {
      set.name = u.name;
      set.qbName = u.name;
    }
    if (u.isActive !== undefined) set.isActive = u.isActive;
    if (Object.keys(set).length) {
      const r = await db.update(t.customers).set(set).where(eq(t.customers.id, id)).returning({ id: t.customers.id });
      if (!r.length) return null;
      if (u.name !== undefined) await db.update(t.invoices).set({ customerName: u.name }).where(eq(t.invoices.customerId, id));
    }
    return (await dataStore.getCustomers()).find((c) => c.id === id) ?? null;
  },
  deleteCustomer: async (id: string): Promise<DeleteResult> => {
    if (!isUuid(id)) return "not_found";
    const db = await getDb();
    const [c] = await db.select({ id: t.customers.id }).from(t.customers).where(eq(t.customers.id, id));
    if (!c) return "not_found";
    const used = await db.select({ id: t.timeEntries.id }).from(t.timeEntries).where(eq(t.timeEntries.customerId, id)).limit(1);
    if (used.length) return "in_use";
    await db.delete(t.customers).where(eq(t.customers.id, id));
    return "ok";
  },

  // ───────── Time entries ─────────
  getTimeEntries: async (f?: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    userId?: string;
    isBillable?: boolean;
    isInvoiced?: boolean;
    isHeld?: boolean;
  }): Promise<TimeEntryItem[]> => {
    if ((f?.customerId && !isUuid(f.customerId)) || (f?.userId && !isUuid(f.userId))) return [];
    const where = and(
      f?.startDate ? gte(t.timeEntries.date, f.startDate) : undefined,
      f?.endDate ? lte(t.timeEntries.date, f.endDate) : undefined,
      f?.customerId ? eq(t.timeEntries.customerId, f.customerId) : undefined,
      f?.userId ? eq(t.timeEntries.userId, f.userId) : undefined,
      f?.isBillable !== undefined ? eq(t.timeEntries.isBillable, f.isBillable) : undefined,
      f?.isInvoiced !== undefined ? eq(t.timeEntries.isInvoiced, f.isInvoiced) : undefined,
      f?.isHeld !== undefined ? eq(t.timeEntries.isHeld, f.isHeld) : undefined
    );
    return (await entryQuery(where)).map(entryOf);
  },
  getTimeEntryById: async (id: string): Promise<TimeEntryItem | undefined> => {
    if (!isUuid(id)) return undefined;
    const [r] = await entryQuery(eq(t.timeEntries.id, id));
    return r ? entryOf(r) : undefined;
  },
  createTimeEntry: async (e: EntryFields & Pick<TimeEntryItem, "userId" | "date" | "durationMinutes">): Promise<TimeEntryItem> => {
    const db = await getDb();
    const [row] = await db
      .insert(t.timeEntries)
      .values({
        userId: e.userId,
        customerId: e.customerId || null,
        date: e.date,
        durationMinutes: toTenths(e.durationMinutes),
        notes: e.notes ?? "",
        isLumpSum: e.isLumpSum ?? false,
        partsNote: e.partsNote ?? "",
        internalNote: e.internalNote ?? "",
        contractPo: e.contractPo ?? "",
        isBillable: e.isBillable ?? true,
        isInvoiced: e.isInvoiced ?? false,
        invoicedOn: e.isInvoiced ? new Date().toLocaleDateString("en-CA") : null,
        isHeld: e.isHeld ?? false,
        status: "draft",
      })
      .returning({ id: t.timeEntries.id });
    return (await dataStore.getTimeEntryById(row.id))!;
  },
  updateTimeEntry: async (id: string, u: EntryFields): Promise<TimeEntryItem | null> => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const set: Partial<typeof t.timeEntries.$inferInsert> = { updatedAt: new Date() };
    if (u.userId !== undefined) set.userId = u.userId;
    if (u.customerId !== undefined) set.customerId = u.customerId || null;
    if (u.date !== undefined) set.date = u.date;
    if (u.durationMinutes !== undefined) set.durationMinutes = toTenths(u.durationMinutes);
    if (u.notes !== undefined) set.notes = u.notes;
    if (u.isLumpSum !== undefined) set.isLumpSum = u.isLumpSum;
    if (u.partsNote !== undefined) set.partsNote = u.partsNote;
    if (u.internalNote !== undefined) set.internalNote = u.internalNote;
    if (u.contractPo !== undefined) set.contractPo = u.contractPo;
    if (u.isBillable !== undefined) set.isBillable = u.isBillable;
    if (u.isInvoiced !== undefined) {
      set.isInvoiced = u.isInvoiced;
      set.invoicedOn = u.isInvoiced ? new Date().toLocaleDateString("en-CA") : null;
    }
    if (u.isHeld !== undefined) set.isHeld = u.isHeld;
    const r = await db.update(t.timeEntries).set(set).where(eq(t.timeEntries.id, id)).returning({ id: t.timeEntries.id });
    if (!r.length) return null;
    return (await dataStore.getTimeEntryById(id)) ?? null;
  },
  deleteTimeEntry: async (id: string): Promise<boolean> => {
    if (!isUuid(id)) return false;
    const db = await getDb();
    const r = await db.delete(t.timeEntries).where(eq(t.timeEntries.id, id)).returning({ id: t.timeEntries.id });
    return r.length > 0;
  },
  /** Marks entries as invoiced (or clears it) in one go. */
  setInvoiced: async (ids: string[], invoiced: boolean, on?: string) => {
    const good = ids.filter(isUuid);
    if (!good.length) return 0;
    const db = await getDb();
    const r = await db
      .update(t.timeEntries)
      .set({ isInvoiced: invoiced, invoicedOn: invoiced ? on ?? new Date().toLocaleDateString("en-CA") : null, updatedAt: new Date() })
      .where(inArray(t.timeEntries.id, good))
      .returning({ id: t.timeEntries.id });
    return r.length;
  },

  // ───────── Bulk import and saved spreadsheets ─────────
  /** Creates any customers that don't exist yet (matched ignoring case/spacing); returns name(lowercase) -> id. */
  ensureCustomers: async (names: string[]): Promise<Map<string, string>> => {
    const db = await getDb();
    const have = new Map((await db.select().from(t.customers)).map((c) => [c.name.trim().toLowerCase(), c.id]));
    const fresh = Array.from(new Set(names.map((n) => n.trim()).filter((n) => n && !have.has(n.toLowerCase()))));
    for (let i = 0; i < fresh.length; i += 100) {
      const rows = await db.insert(t.customers).values(fresh.slice(i, i + 100).map((name) => ({ name, qbName: name }))).returning();
      for (const r of rows) have.set(r.name.trim().toLowerCase(), r.id);
    }
    return have;
  },
  insertEntries: async (rows: { userId: string; customerId: string | null; date: string; durationMinutes: number; notes: string; isLumpSum: boolean; partsNote: string; internalNote: string; contractPo: string; isBillable: boolean; isInvoiced: boolean; isHeld: boolean }[]) => {
    const db = await getDb();
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(t.timeEntries).values(rows.slice(i, i + 100).map((r) => ({ ...r, durationMinutes: toTenths(r.durationMinutes), status: "draft" })));
    }
    return rows.length;
  },
  insertBillingItems: async (rows: { kind: BillingItem["kind"]; customer: string; description: string; amount: number; notes: string }[]) => {
    const db = await getDb();
    for (let i = 0; i < rows.length; i += 100) await db.insert(t.billingItems).values(rows.slice(i, i + 100).map((r) => ({ ...r, amount: String(r.amount) })));
    return rows.length;
  },
  getSavedExports: async () => {
    const db = await getDb();
    const rows = await db
      .select({ id: t.savedExports.id, kind: t.savedExports.kind, period: t.savedExports.period, fileName: t.savedExports.fileName, sizeBytes: t.savedExports.sizeBytes, createdAt: t.savedExports.createdAt })
      .from(t.savedExports)
      .orderBy(desc(t.savedExports.period));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  },
  getSavedExport: async (id: string) => {
    if (!isUuid(id)) return undefined;
    const db = await getDb();
    return (await db.select().from(t.savedExports).where(eq(t.savedExports.id, id)))[0];
  },
  hasSavedExport: async (kind: string, period: string) => {
    const db = await getDb();
    return (await db.select({ id: t.savedExports.id }).from(t.savedExports).where(and(eq(t.savedExports.kind, kind), eq(t.savedExports.period, period)))).length > 0;
  },
  /** One saved file per (kind, period): saving again replaces it. */
  putSavedExport: async (kind: string, period: string, fileName: string, file: Buffer) => {
    const db = await getDb();
    await db.delete(t.savedExports).where(and(eq(t.savedExports.kind, kind), eq(t.savedExports.period, period)));
    await db.insert(t.savedExports).values({ kind, period, fileName, sizeBytes: file.length, data: file.toString("base64") });
  },

  // ───────── Lump sum / Other lists ─────────
  getBillingItems: async (kind?: BillingItem["kind"]): Promise<BillingItem[]> => {
    const db = await getDb();
    const rows = await db.select().from(t.billingItems).where(kind ? eq(t.billingItems.kind, kind) : undefined).orderBy(asc(t.billingItems.createdAt));
    return rows.map(billingItemOf);
  },
  addBillingItem: async (b: { kind: BillingItem["kind"]; customer?: string; description?: string; amount?: number; notes?: string }) => {
    const db = await getDb();
    const [r] = await db
      .insert(t.billingItems)
      .values({ kind: b.kind, customer: b.customer ?? "", description: b.description ?? "", amount: String(b.amount ?? 0), notes: b.notes ?? "" })
      .returning();
    return billingItemOf(r);
  },
  updateBillingItem: async (id: string, u: { customer?: string; description?: string; amount?: number; notes?: string }) => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const set: Partial<typeof t.billingItems.$inferInsert> = {};
    if (u.customer !== undefined) set.customer = u.customer;
    if (u.description !== undefined) set.description = u.description;
    if (u.amount !== undefined) set.amount = String(u.amount);
    if (u.notes !== undefined) set.notes = u.notes;
    if (!Object.keys(set).length) return (await dataStore.getBillingItems()).find((b) => b.id === id) ?? null;
    const [r] = await db.update(t.billingItems).set(set).where(eq(t.billingItems.id, id)).returning();
    return r ? billingItemOf(r) : null;
  },
  deleteBillingItem: async (id: string) => {
    if (!isUuid(id)) return false;
    const db = await getDb();
    const r = await db.delete(t.billingItems).where(eq(t.billingItems.id, id)).returning({ id: t.billingItems.id });
    return r.length > 0;
  },

  // ───────── Invoices ─────────
  getInvoices: async (): Promise<InvoiceRecord[]> => {
    const db = await getDb();
    return (await db.select().from(t.invoices).orderBy(desc(t.invoices.createdAt), desc(t.invoices.dateTo))).map(invoiceOf);
  },
  getInvoice: async (id: string) => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const [r] = await db.select().from(t.invoices).where(eq(t.invoices.id, id));
    return r ? { ...invoiceOf(r), snapshot: r.snapshot ? (JSON.parse(r.snapshot) as unknown) : null } : null;
  },
  /** Records an invoice and marks the entries on it as invoiced, all in one call. */
  createInvoice: async (i: { customerId: string | null; customerName: string; dateFrom: string; dateTo: string; total: number; snapshot: unknown; createdBy: string; entryIds: string[] }) => {
    const db = await getDb();
    const [r] = await db
      .insert(t.invoices)
      .values({
        customerId: i.customerId && isUuid(i.customerId) ? i.customerId : null,
        customerName: i.customerName,
        dateFrom: i.dateFrom,
        dateTo: i.dateTo,
        total: i.total.toFixed(2),
        snapshot: JSON.stringify(i.snapshot),
        createdBy: i.createdBy,
      })
      .returning();
    await dataStore.setInvoiced(i.entryIds, true);
    return invoiceOf(r);
  },
  /** Deletes an invoice record and puts the entries on it back to "not invoiced". */
  deleteInvoice: async (id: string) => {
    const inv = await dataStore.getInvoice(id);
    if (!inv) return false;
    const ids = ((inv.snapshot as { entryIds?: string[] } | null)?.entryIds ?? []).filter((x) => typeof x === "string");
    await dataStore.setInvoiced(ids, false);
    const db = await getDb();
    await db.delete(t.invoices).where(eq(t.invoices.id, id));
    return true;
  },

  // ───────── Demo data ─────────
  isDemo: async (): Promise<boolean> => {
    const db = await getDb();
    const [r] = await db.select().from(t.appMeta).where(eq(t.appMeta.key, "demo"));
    return r?.value === "true";
  },
  /** Wipes every record (used to drop the sample data and start fresh). */
  clearAllData: async () => {
    const db = await getDb();
    await db.delete(t.savedExports);
    await db.delete(t.invoices);
    await db.delete(t.billingItems);
    await db.delete(t.activeTimers);
    await db.delete(t.timeEntries);
    await db.delete(t.jobs);
    await db.delete(t.customers);
    await db.delete(t.serviceItems);
    await db.delete(t.users);
    await db.delete(t.appMeta).where(eq(t.appMeta.key, "demo"));
  },
};
