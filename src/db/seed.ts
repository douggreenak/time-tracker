import { createHash } from "node:crypto";
import * as schema from "./schema";
import type { Db } from "./client";
import { hashPassword } from "../lib/password";
import { initialCustomers, initialServiceItems, initialTimeEntries, initialUsers } from "./mock-data";

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
  out.push(db.insert(schema.users).values(
    initialUsers.map((u) => ({
      passwordHash: demoHash,
      id: id(u.id),
      name: u.name,
      email: u.email,
      role: u.role,
      qbEmployeeName: u.qbEmployeeName,
      defaultHourlyRate: String(u.defaultHourlyRate),
    }))
  ).onConflictDoNothing());
  out.push(db.insert(schema.customers).values(
    initialCustomers.map((c) => ({ id: id(c.id), name: c.name, qbName: c.qbName, isActive: c.isActive }))
  ).onConflictDoNothing());
  const jobs = initialCustomers.flatMap((c) => c.jobs);
  if (jobs.length)
    out.push(db.insert(schema.jobs).values(
      jobs.map((j) => ({
        id: id(j.id),
        customerId: id(j.customerId),
        name: j.name,
        fullQbJobName: j.fullQbJobName,
        isActive: j.isActive,
      }))
    ).onConflictDoNothing());
  out.push(db.insert(schema.serviceItems).values(
    initialServiceItems.map((s) => ({ id: id(s.id), name: s.name, qbItemName: s.qbItemName, defaultBillable: s.defaultBillable }))
  ).onConflictDoNothing());
  if (initialTimeEntries.length)
    out.push(db.insert(schema.timeEntries).values(
      initialTimeEntries.map((e) => ({
        id: id(e.id),
        userId: id(e.userId),
        customerId: id(e.customerId),
        jobId: e.jobId ? id(e.jobId) : null,
        serviceItemId: id(e.serviceItemId),
        date: e.date,
        durationMinutes: e.durationMinutes,
        locationType: e.locationType,
        locationName: e.locationName ?? null,
        latitude: e.latitude != null ? String(e.latitude) : null,
        longitude: e.longitude != null ? String(e.longitude) : null,
        notes: e.notes ?? null,
        isBillable: e.isBillable,
        status: e.status,
        createdAt: new Date(e.createdAt),
      }))
    ).onConflictDoNothing());
  return out;
}

/** Hash for the sample people's shared password. */
export const demoHash = () => hashPassword(DEMO_PASSWORD);
