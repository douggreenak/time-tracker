import { and, asc, eq, gte, lte, lt, gt, sql } from "drizzle-orm";
import { getDb } from "./client";
import * as t from "./schema";
import type { ParsedArc, Pt } from "@/lib/location";

const CHUNK = 1000;
async function chunked<T>(rows: T[], run: (part: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await run(rows.slice(i, i + CHUNK));
}

/** Everything the location features read and write. Every call is scoped to one person: nobody sees anyone else's. */
export const locationStore = {
  async addPoints(userId: string, points: Pt[], src: "device" | "arc" = "device"): Promise<void> {
    const db = await getDb();
    await chunked(points, (part) =>
      db.insert(t.locationPoints).values(part.map((p) => ({ userId, t: Math.round(p.t), lat: p.lat, lon: p.lon, acc: p.acc ?? null, src }))).onConflictDoNothing());
  },

  async points(userId: string, fromMs: number, toMs: number): Promise<(Pt & { src: string })[]> {
    const db = await getDb();
    const rows = await db.select().from(t.locationPoints)
      .where(and(eq(t.locationPoints.userId, userId), gte(t.locationPoints.t, fromMs), lt(t.locationPoints.t, toMs)))
      .orderBy(asc(t.locationPoints.t));
    return rows.map((r) => ({ t: r.t, lat: r.lat, lon: r.lon, acc: r.acc, src: r.src }));
  },

  async lastPointAt(userId: string): Promise<number | null> {
    const db = await getDb();
    const [r] = await db.select({ m: sql<number | null>`max(${t.locationPoints.t})` }).from(t.locationPoints).where(eq(t.locationPoints.userId, userId));
    return r?.m == null ? null : Number(r.m);
  },

  async visits(userId: string, fromMs: number, toMs: number) {
    const db = await getDb();
    return db.select().from(t.locationVisits)
      .where(and(eq(t.locationVisits.userId, userId), lt(t.locationVisits.startMs, toMs), gt(t.locationVisits.endMs, fromMs)))
      .orderBy(asc(t.locationVisits.startMs));
  },

  async trips(userId: string, fromMs: number, toMs: number) {
    const db = await getDb();
    return db.select().from(t.locationTrips)
      .where(and(eq(t.locationTrips.userId, userId), lt(t.locationTrips.startMs, toMs), gt(t.locationTrips.endMs, fromMs)))
      .orderBy(asc(t.locationTrips.startMs));
  },

  async places(userId: string): Promise<Record<string, { name: string; subtitle: string; byUser: boolean }>> {
    const db = await getDb();
    const rows = await db.select().from(t.locationPlaces).where(eq(t.locationPlaces.userId, userId));
    return Object.fromEntries(rows.map((r) => [r.key, { name: r.name, subtitle: r.subtitle, byUser: r.byUser }]));
  },

  /** `byUser` names (typed by a person) replace anything; automatic ones only fill gaps and never override a typed name. */
  async setPlaces(userId: string, list: { key: string; name: string; subtitle?: string }[], byUser: boolean): Promise<void> {
    const db = await getDb();
    await chunked(list, async (part) => {
      const q = db.insert(t.locationPlaces).values(part.map((p) => ({ userId, key: p.key, name: p.name, subtitle: p.subtitle ?? "", byUser })));
      await (byUser
        ? q.onConflictDoUpdate({ target: [t.locationPlaces.userId, t.locationPlaces.key], set: { name: sql`excluded.name`, subtitle: sql`excluded.subtitle`, byUser: sql`true` } })
        : q.onConflictDoUpdate({ target: [t.locationPlaces.userId, t.locationPlaces.key], set: { name: sql`excluded.name`, subtitle: sql`excluded.subtitle` }, setWhere: eq(t.locationPlaces.byUser, false) }));
    });
  },

  async dismissed(userId: string): Promise<Set<string>> {
    const db = await getDb();
    const rows = await db.select({ id: t.locationDismissed.stayId }).from(t.locationDismissed).where(eq(t.locationDismissed.userId, userId));
    return new Set(rows.map((r) => r.id));
  },
  async dismiss(userId: string, stayId: string, undo = false): Promise<void> {
    const db = await getDb();
    if (undo) await db.delete(t.locationDismissed).where(and(eq(t.locationDismissed.userId, userId), eq(t.locationDismissed.stayId, stayId)));
    else await db.insert(t.locationDismissed).values({ userId, stayId }).onConflictDoNothing();
  },

  /** Stores what was read from an Arc export. Safe to repeat: items already imported are skipped. */
  async importArc(userId: string, p: ParsedArc): Promise<{ visits: number; trips: number; points: number }> {
    const db = await getDb();
    let visits = 0, trips = 0;
    await chunked(p.visits, async (part) => {
      const r = await db.insert(t.locationVisits).values(part.map((v) => ({ userId, extId: v.extId, startMs: v.startMs, endMs: v.endMs, lat: v.lat, lon: v.lon, name: v.name, address: v.address, src: "arc" })))
        .onConflictDoNothing().returning({ id: t.locationVisits.id });
      visits += r.length;
    });
    await chunked(p.trips, async (part) => {
      const r = await db.insert(t.locationTrips).values(part.map((v) => ({ userId, extId: v.extId, startMs: v.startMs, endMs: v.endMs, meters: v.meters, activity: v.activity, src: "arc" })))
        .onConflictDoNothing().returning({ id: t.locationTrips.startMs });
      trips += r.length;
    });
    const before = p.points.length;
    await locationStore.addPoints(userId, p.points, "arc");
    // Arc's own place names become the names of those spots (never replacing one a person typed).
    const names = new Map<string, { key: string; name: string; subtitle: string }>();
    for (const v of p.visits) if (v.name) names.set(`${v.lat.toFixed(3)},${v.lon.toFixed(3)}`, { key: `${v.lat.toFixed(3)},${v.lon.toFixed(3)}`, name: v.name, subtitle: v.address ?? "" });
    await locationStore.setPlaces(userId, Array.from(names.values()), false);
    return { visits, trips, points: before };
  },

  async counts(userId: string) {
    const db = await getDb();
    const one = async (table: typeof t.locationPoints | typeof t.locationVisits, extra?: ReturnType<typeof eq>) => {
      const [r] = await db.select({ n: sql<number>`count(*)` }).from(table as typeof t.locationPoints).where(and(eq((table as typeof t.locationPoints).userId, userId), extra));
      return Number(r?.n ?? 0);
    };
    return { points: await one(t.locationPoints), visits: await one(t.locationVisits) };
  },

  async erase(userId: string, which: "all" | "device" | "arc"): Promise<void> {
    const db = await getDb();
    const bySrc = (col: typeof t.locationPoints.src | typeof t.locationVisits.src | typeof t.locationTrips.src) => (which === "all" ? undefined : eq(col as typeof t.locationPoints.src, which));
    await db.delete(t.locationPoints).where(and(eq(t.locationPoints.userId, userId), bySrc(t.locationPoints.src)));
    await db.delete(t.locationVisits).where(and(eq(t.locationVisits.userId, userId), bySrc(t.locationVisits.src)));
    await db.delete(t.locationTrips).where(and(eq(t.locationTrips.userId, userId), bySrc(t.locationTrips.src)));
    if (which === "all") {
      await db.delete(t.locationPlaces).where(eq(t.locationPlaces.userId, userId));
      await db.delete(t.locationDismissed).where(eq(t.locationDismissed.userId, userId));
    }
  },
};
