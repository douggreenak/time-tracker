import * as schema from "./schema";
import type { Db } from "./client";
import { hashPassword } from "../lib/password";
import { initialCustomers, initialServiceItems, initialTimeEntries, initialUsers } from "./mock-data";

export const DEMO_PASSWORD = "demo1234";

/** Loads the sample data from mock-data.ts into an empty database (ids become real UUIDs). */
export async function seedDemoData(db: Db) {
  const uid = new Map<string, string>();
  const id = (old: string) => {
    if (!uid.has(old)) uid.set(old, crypto.randomUUID());
    return uid.get(old)!;
  };

  const demoHash = await hashPassword(DEMO_PASSWORD);
  await db.insert(schema.users).values(
    initialUsers.map((u) => ({
      passwordHash: demoHash,
      id: id(u.id),
      name: u.name,
      email: u.email,
      role: u.role,
      qbEmployeeName: u.qbEmployeeName,
      defaultHourlyRate: String(u.defaultHourlyRate),
    }))
  );
  await db.insert(schema.customers).values(
    initialCustomers.map((c) => ({ id: id(c.id), name: c.name, qbName: c.qbName, isActive: c.isActive }))
  );
  const jobs = initialCustomers.flatMap((c) => c.jobs);
  if (jobs.length)
    await db.insert(schema.jobs).values(
      jobs.map((j) => ({
        id: id(j.id),
        customerId: id(j.customerId),
        name: j.name,
        fullQbJobName: j.fullQbJobName,
        isActive: j.isActive,
      }))
    );
  await db.insert(schema.serviceItems).values(
    initialServiceItems.map((s) => ({ id: id(s.id), name: s.name, qbItemName: s.qbItemName, defaultBillable: s.defaultBillable }))
  );
  if (initialTimeEntries.length)
    await db.insert(schema.timeEntries).values(
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
    );
}
