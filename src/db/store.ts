import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { getDb } from "./client";
import * as t from "./schema";
import type { CustomerItem, FlagNote, JobItem, ServiceItem, TimeEntryItem, UserItem } from "./mock-data";

export type DeleteResult = "ok" | "not_found" | "in_use";

type Loc = TimeEntryItem["locationType"];
const num = (v: string | null) => (v == null ? null : Number(v));
const ci = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
// Postgres rejects malformed uuids; treat them as "not found" instead of a 500.
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const userOf = (r: typeof t.users.$inferSelect): UserItem => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role as UserItem["role"],
  qbEmployeeName: r.qbEmployeeName ?? r.name,
  defaultHourlyRate: Number(r.defaultHourlyRate ?? 0),
});

const entrySelect = {
  id: t.timeEntries.id,
  userId: t.timeEntries.userId,
  userName: t.users.name,
  customerId: t.timeEntries.customerId,
  customerName: t.customers.name,
  jobId: t.timeEntries.jobId,
  jobName: t.jobs.name,
  serviceItemId: t.timeEntries.serviceItemId,
  serviceItemName: t.serviceItems.name,
  date: t.timeEntries.date,
  durationMinutes: t.timeEntries.durationMinutes,
  locationType: t.timeEntries.locationType,
  locationName: t.timeEntries.locationName,
  latitude: t.timeEntries.latitude,
  longitude: t.timeEntries.longitude,
  notes: t.timeEntries.notes,
  isBillable: t.timeEntries.isBillable,
  status: t.timeEntries.status,
  flagged: t.timeEntries.flagged,
  flagReason: t.timeEntries.flagReason,
  flagHistory: t.timeEntries.flagHistory,
  dismissedIssues: t.timeEntries.dismissedIssues,
  createdAt: t.timeEntries.createdAt,
};

type EntryRow = Awaited<ReturnType<typeof entryQuery>>[number];

// Customer, project and task are optional: "" means none.
function parseHistory(raw: string | null | undefined): FlagNote[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const entryOf = (r: EntryRow): TimeEntryItem => ({
  ...r,
  customerId: r.customerId ?? "",
  customerName: r.customerName ?? "",
  serviceItemId: r.serviceItemId ?? "",
  serviceItemName: r.serviceItemName ?? "",
  jobId: r.jobId,
  jobName: r.jobName,
  locationType: r.locationType as Loc,
  latitude: num(r.latitude),
  longitude: num(r.longitude),
  status: r.status as TimeEntryItem["status"],
  flagHistory: parseHistory(r.flagHistory),
  dismissedIssues: parseList(r.dismissedIssues),
  createdAt: r.createdAt.toISOString(),
});

async function entryQuery(where?: SQL) {
  const db = await getDb();
  return db
    .select(entrySelect)
    .from(t.timeEntries)
    .innerJoin(t.users, eq(t.timeEntries.userId, t.users.id))
    .leftJoin(t.customers, eq(t.timeEntries.customerId, t.customers.id))
    .leftJoin(t.serviceItems, eq(t.timeEntries.serviceItemId, t.serviceItems.id))
    .leftJoin(t.jobs, eq(t.timeEntries.jobId, t.jobs.id))
    .where(where)
    .orderBy(desc(t.timeEntries.date), desc(t.timeEntries.createdAt));
}

const h = (min: number) => (min / 60).toFixed(2);
function describeChanges(a: TimeEntryItem, b: TimeEntryItem): string[] {
  const out: string[] = [];
  if (a.durationMinutes !== b.durationMinutes) out.push(`hours ${h(a.durationMinutes)} → ${h(b.durationMinutes)}`);
  if (a.date !== b.date) out.push(`date ${a.date} → ${b.date}`);
  if (a.customerId !== b.customerId) out.push(`customer ${a.customerName || "none"} → ${b.customerName || "none"}`);
  if ((a.jobId ?? "") !== (b.jobId ?? "")) out.push(`project ${a.jobName ?? "none"} → ${b.jobName ?? "none"}`);
  if (a.serviceItemId !== b.serviceItemId) out.push(`task ${a.serviceItemName || "none"} → ${b.serviceItemName || "none"}`);
  if (a.isBillable !== b.isBillable) out.push(b.isBillable ? "marked billable" : "marked non-billable");
  if (a.locationType !== b.locationType) out.push(`location ${a.locationType} → ${b.locationType}`);
  if ((a.notes ?? "") !== (b.notes ?? "")) out.push("notes changed");
  return out;
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
  addUser: async (u: { name: string; email: string; role?: string; qbEmployeeName?: string; defaultHourlyRate?: number; passwordHash?: string }) => {
    const db = await getDb();
    const [r] = await db
      .insert(t.users)
      .values({
        name: u.name,
        email: u.email.trim().toLowerCase(), // emails are always stored in lowercase
        role: u.role || "engineer",
        qbEmployeeName: u.qbEmployeeName || u.name,
        defaultHourlyRate: String(u.defaultHourlyRate ?? 125),
        passwordHash: u.passwordHash ?? null,
      })
      .returning();
    return userOf(r);
  },
  updateUser: async (
    id: string,
    u: { name?: string; email?: string; role?: string; qbEmployeeName?: string; defaultHourlyRate?: number }
  ) => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const set: Partial<typeof t.users.$inferInsert> = {};
    if (u.name !== undefined) set.name = u.name;
    if (u.email !== undefined) set.email = u.email.trim().toLowerCase();
    if (u.role !== undefined) set.role = u.role;
    if (u.qbEmployeeName !== undefined) set.qbEmployeeName = u.qbEmployeeName;
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

  // ───────── Customers & jobs ─────────
  getCustomers: async (): Promise<CustomerItem[]> => {
    const db = await getDb();
    const [cs, js] = await Promise.all([
      db.select().from(t.customers).orderBy(asc(t.customers.name)),
      db.select().from(t.jobs).orderBy(asc(t.jobs.name)),
    ]);
    return cs.map((c) => ({
      id: c.id,
      name: c.name,
      qbName: c.qbName,
      isActive: c.isActive,
      jobs: js
        .filter((j) => j.customerId === c.id)
        .map((j) => ({ id: j.id, customerId: j.customerId, name: j.name, fullQbJobName: j.fullQbJobName, isActive: j.isActive })),
    }));
  },
  addCustomer: async (name: string, qbName?: string): Promise<CustomerItem> => {
    const existing = (await dataStore.getCustomers()).find((c) => ci(c.name, name));
    if (existing) return existing; // double-submit / create-on-type safe
    const db = await getDb();
    const [c] = await db.insert(t.customers).values({ name, qbName: qbName || name }).returning();
    return { id: c.id, name: c.name, qbName: c.qbName, isActive: c.isActive, jobs: [] };
  },
  addJob: async (customerId: string, name: string): Promise<JobItem | null> => {
    if (!isUuid(customerId)) return null;
    const db = await getDb();
    const [cust] = await db.select().from(t.customers).where(eq(t.customers.id, customerId));
    if (!cust) return null;
    const [dupe] = await db.select().from(t.jobs).where(and(eq(t.jobs.customerId, customerId), sql`lower(${t.jobs.name}) = ${name.trim().toLowerCase()}`));
    const j =
      dupe ??
      (await db.insert(t.jobs).values({ customerId, name, fullQbJobName: `${cust.qbName}:${name}` }).returning())[0];
    return { id: j.id, customerId: j.customerId, name: j.name, fullQbJobName: j.fullQbJobName, isActive: j.isActive };
  },
  updateCustomer: async (id: string, u: { name?: string; qbName?: string; isActive?: boolean }): Promise<CustomerItem | null> => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const set: Partial<typeof t.customers.$inferInsert> = {};
    if (u.name !== undefined) set.name = u.name;
    if (u.qbName !== undefined) set.qbName = u.qbName;
    if (u.isActive !== undefined) set.isActive = u.isActive;
    if (Object.keys(set).length) {
      const r = await db.update(t.customers).set(set).where(eq(t.customers.id, id)).returning({ id: t.customers.id });
      if (!r.length) return null;
    }
    const cust = (await dataStore.getCustomers()).find((c) => c.id === id);
    if (!cust) return null;
    if (u.qbName !== undefined) {
      // QuickBooks job names are "<customer QB name>:<job>" — keep them in step.
      await db.update(t.jobs).set({ fullQbJobName: sql`${cust.qbName} || ':' || ${t.jobs.name}` }).where(eq(t.jobs.customerId, id));
      return (await dataStore.getCustomers()).find((c) => c.id === id) ?? null;
    }
    return cust;
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
  updateJob: async (id: string, u: { name?: string; isActive?: boolean }): Promise<JobItem | null> => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const [cur] = await db
      .select({ job: t.jobs, qb: t.customers.qbName })
      .from(t.jobs)
      .innerJoin(t.customers, eq(t.jobs.customerId, t.customers.id))
      .where(eq(t.jobs.id, id));
    if (!cur) return null;
    const name = u.name ?? cur.job.name;
    const [j] = await db
      .update(t.jobs)
      .set({ name, fullQbJobName: `${cur.qb}:${name}`, ...(u.isActive !== undefined ? { isActive: u.isActive } : {}) })
      .where(eq(t.jobs.id, id))
      .returning();
    return { id: j.id, customerId: j.customerId, name: j.name, fullQbJobName: j.fullQbJobName, isActive: j.isActive };
  },
  deleteJob: async (id: string): Promise<DeleteResult> => {
    if (!isUuid(id)) return "not_found";
    const db = await getDb();
    const [j] = await db.select({ id: t.jobs.id }).from(t.jobs).where(eq(t.jobs.id, id));
    if (!j) return "not_found";
    const used = await db.select({ id: t.timeEntries.id }).from(t.timeEntries).where(eq(t.timeEntries.jobId, id)).limit(1);
    if (used.length) return "in_use";
    await db.delete(t.jobs).where(eq(t.jobs.id, id));
    return "ok";
  },

  // ───────── Service items ─────────
  getServiceItems: async (): Promise<ServiceItem[]> => {
    const db = await getDb();
    return db.select().from(t.serviceItems).orderBy(asc(t.serviceItems.name)).then((rows) =>
      rows.map((s) => ({ id: s.id, name: s.name, qbItemName: s.qbItemName, defaultBillable: s.defaultBillable }))
    );
  },
  addServiceItem: async (name: string, qbItemName?: string, defaultBillable = true): Promise<ServiceItem> => {
    const existing = (await dataStore.getServiceItems()).find((s) => ci(s.name, name));
    if (existing) return existing;
    const db = await getDb();
    const [s] = await db.insert(t.serviceItems).values({ name, qbItemName: qbItemName || name, defaultBillable }).returning();
    return { id: s.id, name: s.name, qbItemName: s.qbItemName, defaultBillable: s.defaultBillable };
  },
  updateServiceItem: async (id: string, u: { name?: string; qbItemName?: string; defaultBillable?: boolean }): Promise<ServiceItem | null> => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const set: Partial<typeof t.serviceItems.$inferInsert> = {};
    if (u.name !== undefined) set.name = u.name;
    if (u.qbItemName !== undefined) set.qbItemName = u.qbItemName;
    if (u.defaultBillable !== undefined) set.defaultBillable = u.defaultBillable;
    if (!Object.keys(set).length) return (await dataStore.getServiceItems()).find((s) => s.id === id) ?? null;
    const [s] = await db.update(t.serviceItems).set(set).where(eq(t.serviceItems.id, id)).returning();
    return s ? { id: s.id, name: s.name, qbItemName: s.qbItemName, defaultBillable: s.defaultBillable } : null;
  },
  deleteServiceItem: async (id: string): Promise<DeleteResult> => {
    if (!isUuid(id)) return "not_found";
    const db = await getDb();
    const [s] = await db.select({ id: t.serviceItems.id }).from(t.serviceItems).where(eq(t.serviceItems.id, id));
    if (!s) return "not_found";
    const used = await db.select({ id: t.timeEntries.id }).from(t.timeEntries).where(eq(t.timeEntries.serviceItemId, id)).limit(1);
    if (used.length) return "in_use";
    await db.delete(t.serviceItems).where(eq(t.serviceItems.id, id));
    return "ok";
  },

  // ───────── Time entries ─────────
  getTimeEntries: async (f?: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    userId?: string;
    status?: string;
    isBillable?: boolean;
  }): Promise<TimeEntryItem[]> => {
    if ((f?.customerId && !isUuid(f.customerId)) || (f?.userId && !isUuid(f.userId))) return [];
    const where = and(
      f?.startDate ? gte(t.timeEntries.date, f.startDate) : undefined,
      f?.endDate ? lte(t.timeEntries.date, f.endDate) : undefined,
      f?.customerId ? eq(t.timeEntries.customerId, f.customerId) : undefined,
      f?.userId ? eq(t.timeEntries.userId, f.userId) : undefined,
      f?.status && f.status !== "all" ? eq(t.timeEntries.status, f.status) : undefined,
      f?.isBillable !== undefined ? eq(t.timeEntries.isBillable, f.isBillable) : undefined
    );
    return (await entryQuery(where)).map(entryOf);
  },
  getTimeEntryById: async (id: string): Promise<TimeEntryItem | undefined> => {
    if (!isUuid(id)) return undefined;
    const [r] = await entryQuery(eq(t.timeEntries.id, id));
    return r ? entryOf(r) : undefined;
  },
  createTimeEntry: async (e: Partial<TimeEntryItem> & Pick<TimeEntryItem, "userId" | "date" | "durationMinutes">): Promise<TimeEntryItem> => {
    const db = await getDb();
    const [row] = await db
      .insert(t.timeEntries)
      .values({
        userId: e.userId,
        customerId: e.customerId || null,
        jobId: e.customerId ? e.jobId || null : null,
        serviceItemId: e.serviceItemId || null,
        date: e.date,
        durationMinutes: e.durationMinutes,
        locationType: e.locationType || "office",
        locationName: e.locationName ?? null,
        latitude: e.latitude != null ? String(e.latitude) : null,
        longitude: e.longitude != null ? String(e.longitude) : null,
        notes: e.notes ?? "",
        isBillable: e.isBillable ?? true,
        status: e.status || "draft",
      })
      .returning({ id: t.timeEntries.id });
    return (await dataStore.getTimeEntryById(row.id))!;
  },
  /**
   * Updates an entry. A status in the patch is an accountant action (approve / export / reopen).
   * A content edit to an entry that was already approved or exported puts it back in the review
   * queue: status → submitted, flagged, with a plain-English note of what changed.
   */
  updateTimeEntry: async (id: string, u: Partial<TimeEntryItem>, actor = "System"): Promise<TimeEntryItem | null> => {
    if (!isUuid(id)) return null;
    const db = await getDb();
    const before = await dataStore.getTimeEntryById(id);
    if (!before) return null;

    const set: Partial<typeof t.timeEntries.$inferInsert> = { updatedAt: new Date() };
    if (u.userId !== undefined) set.userId = u.userId;
    if (u.customerId !== undefined) set.customerId = u.customerId || null;
    if (u.jobId !== undefined) set.jobId = u.jobId || null;
    if (u.customerId !== undefined && !u.customerId) set.jobId = null; // a project needs its customer
    if (u.serviceItemId !== undefined) set.serviceItemId = u.serviceItemId || null;
    if (u.date !== undefined) set.date = u.date;
    if (u.durationMinutes !== undefined) set.durationMinutes = Math.round(Number(u.durationMinutes));
    if (u.locationType !== undefined) set.locationType = u.locationType;
    if (u.locationName !== undefined) set.locationName = u.locationName;
    if (u.latitude !== undefined) set.latitude = u.latitude == null ? null : String(u.latitude);
    if (u.longitude !== undefined) set.longitude = u.longitude == null ? null : String(u.longitude);
    if (u.notes !== undefined) set.notes = u.notes;
    if (u.isBillable !== undefined) set.isBillable = u.isBillable;
    if (u.status !== undefined) {
      set.status = u.status;
      if (u.status === "approved" || u.status === "exported") {
        set.flagged = false;
        set.flagReason = null;
      }
    }
    if (u.dismissedIssues !== undefined) set.dismissedIssues = JSON.stringify(u.dismissedIssues);
    if (u.flagged !== undefined) set.flagged = u.flagged;
    if (u.flagReason !== undefined) set.flagReason = u.flagReason;
    // Withdrawing a question clears the flag; the note stays in the history.
    if (u.flagged === false && u.status === undefined) set.flagReason = null;

    const notes: FlagNote[] = [];
    const note = (kind: FlagNote["kind"], text: string) => notes.push({ at: new Date().toISOString(), by: actor, kind, text: text.slice(0, 500) });
    if (u.flagged === true && u.flagReason) note("question", u.flagReason.replace(/^Accountant asks:\s*/, ""));
    if (u.flagged === false && u.status === undefined && before.flagged) note("withdrawn", "Question withdrawn — flag cleared");
    if ((u.status === "approved" || u.status === "exported") && before.flagged) note("cleared", `Marked ${u.status} — flag cleared`);

    const r = await db.update(t.timeEntries).set(set).where(eq(t.timeEntries.id, id)).returning({ id: t.timeEntries.id });
    if (!r.length) return null;
    let after = (await dataStore.getTimeEntryById(id)) ?? null;

    const wasLocked = before.status === "approved" || before.status === "exported";
    if (after && wasLocked && u.status === undefined) {
      const changes = describeChanges(before, after);
      if (changes.length) {
        const text = `Edited after ${before.status}: ${changes.join("; ")}`;
        note("edit", text);
        await db
          .update(t.timeEntries)
          .set({ status: "submitted", flagged: true, flagReason: text.slice(0, 500) })
          .where(eq(t.timeEntries.id, id));
        after = (await dataStore.getTimeEntryById(id)) ?? null;
      }
    } else if (after?.flagged && u.status === undefined && u.flagged === undefined) {
      const changes = describeChanges(before, after);
      if (changes.length) {
        const text = `${before.flagReason ?? ""}${before.flagReason ? " · " : ""}then: ${changes.join("; ")}`;
        note("edit", `Then edited: ${changes.join("; ")}`);
        await db.update(t.timeEntries).set({ flagReason: text.slice(0, 500) }).where(eq(t.timeEntries.id, id));
        after = (await dataStore.getTimeEntryById(id)) ?? null;
      }
    }
    if (notes.length) {
      await db
        .update(t.timeEntries)
        .set({ flagHistory: JSON.stringify([...(before.flagHistory ?? []), ...notes]) })
        .where(eq(t.timeEntries.id, id));
      after = (await dataStore.getTimeEntryById(id)) ?? null;
    }
    return after;
  },
  deleteTimeEntry: async (id: string): Promise<boolean> => {
    if (!isUuid(id)) return false;
    const db = await getDb();
    const r = await db.delete(t.timeEntries).where(eq(t.timeEntries.id, id)).returning({ id: t.timeEntries.id });
    return r.length > 0;
  },

  // ───────── Active timer (one per user, stored in the database) ─────────
  getActiveTimer: async (userId: string) => {
    if (!isUuid(userId)) return null;
    const db = await getDb();
    const [r] = await db.select().from(t.activeTimers).where(eq(t.activeTimers.userId, userId));
    if (!r) return null;
    return {
      userId: r.userId,
      customerId: r.customerId ?? undefined,
      jobId: r.jobId ?? undefined,
      serviceItemId: r.serviceItemId ?? undefined,
      locationType: r.locationType as Loc,
      startTime: r.startTime.getTime(),
      elapsedBeforePause: r.pausedDurationSeconds,
      isRunning: r.isRunning,
      notes: r.notes ?? undefined,
    };
  },
  startTimer: async (p: {
    userId: string;
    customerId?: string;
    jobId?: string;
    serviceItemId?: string;
    locationType: Loc;
    notes?: string;
  }) => {
    const db = await getDb();
    await db.delete(t.activeTimers).where(eq(t.activeTimers.userId, p.userId));
    await db.insert(t.activeTimers).values({
      userId: p.userId,
      customerId: p.customerId || null,
      jobId: p.jobId || null,
      serviceItemId: p.serviceItemId || null,
      locationType: p.locationType,
      startTime: new Date(),
      notes: p.notes ?? "",
    });
    return dataStore.getActiveTimer(p.userId);
  },
  /** Autosave of the picker/notes while a timer is open. */
  updateTimer: async (userId: string, u: { customerId?: string | null; jobId?: string | null; serviceItemId?: string | null; locationType?: Loc; notes?: string }) => {
    const db = await getDb();
    const set: Partial<typeof t.activeTimers.$inferInsert> = {};
    if (u.customerId !== undefined) set.customerId = u.customerId || null;
    if (u.jobId !== undefined) set.jobId = u.jobId || null;
    if (u.serviceItemId !== undefined) set.serviceItemId = u.serviceItemId || null;
    if (u.locationType !== undefined) set.locationType = u.locationType;
    if (u.notes !== undefined) set.notes = u.notes;
    if (Object.keys(set).length) await db.update(t.activeTimers).set(set).where(eq(t.activeTimers.userId, userId));
    return dataStore.getActiveTimer(userId);
  },
  pauseTimer: async (userId: string) => {
    const cur = await dataStore.getActiveTimer(userId);
    if (cur?.isRunning) {
      const db = await getDb();
      const extra = Math.floor((Date.now() - cur.startTime) / 1000);
      await db
        .update(t.activeTimers)
        .set({ pausedDurationSeconds: cur.elapsedBeforePause + extra, isRunning: false })
        .where(eq(t.activeTimers.userId, userId));
    }
    return dataStore.getActiveTimer(userId);
  },
  resumeTimer: async (userId: string) => {
    const cur = await dataStore.getActiveTimer(userId);
    if (cur && !cur.isRunning) {
      const db = await getDb();
      await db.update(t.activeTimers).set({ startTime: new Date(), isRunning: true }).where(eq(t.activeTimers.userId, userId));
    }
    return dataStore.getActiveTimer(userId);
  },
  stopTimer: async (userId: string): Promise<TimeEntryItem | null> => {
    const cur = await dataStore.getActiveTimer(userId);
    if (!cur) return null;
    const seconds = cur.elapsedBeforePause + (cur.isRunning ? Math.floor((Date.now() - cur.startTime) / 1000) : 0);
    const [customers, services] = await Promise.all([dataStore.getCustomers(), dataStore.getServiceItems()]);
    const cust = customers.find((c) => c.id === cur.customerId);
    const srv = services.find((s) => s.id === cur.serviceItemId);
    const job = cust?.jobs.find((j) => j.id === cur.jobId);
    const entry = await dataStore.createTimeEntry({
      userId,
      customerId: cust?.id ?? "",
      jobId: job?.id ?? null,
      serviceItemId: srv?.id ?? "",
      date: new Date().toLocaleDateString("en-CA"),
      durationMinutes: Math.max(1, Math.round(seconds / 60)),
      locationType: cur.locationType,
      notes: cur.notes || "Recorded with stopwatch",
      isBillable: srv?.defaultBillable ?? true,
      status: "draft",
    });
    await dataStore.discardTimer(userId);
    return entry;
  },
  discardTimer: async (userId: string) => {
    const db = await getDb();
    const r = await db.delete(t.activeTimers).where(eq(t.activeTimers.userId, userId)).returning({ id: t.activeTimers.id });
    return r.length > 0;
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
    await db.delete(t.activeTimers);
    await db.delete(t.timeEntries);
    await db.delete(t.jobs);
    await db.delete(t.customers);
    await db.delete(t.serviceItems);
    await db.delete(t.users);
    await db.delete(t.appMeta).where(eq(t.appMeta.key, "demo"));
  },
};
