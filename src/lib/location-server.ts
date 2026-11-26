import { dataStore } from "@/db/store";
import { locationStore } from "@/db/locations";
import { addDays, buildTimeline, dayOf, placeKey, safeZone, startOfDayMs, suggest, type Stay, type Trip } from "@/lib/location";

export interface TimelineStayJson {
  kind: "stay"; id: string; start: number; end: number; minutes: number; lat: number; lon: number;
  isHome: boolean; src: string; name: string | null; subtitle: string; key: string;
}
export interface TimelineTripJson { kind: "trip"; id: string; start: number; end: number; minutes: number; meters: number; activity: string | null }
export interface DayJson { date: string; items: (TimelineStayJson | TimelineTripJson)[]; placeMinutes: number }
export interface SuggestionJson { id: string; date: string; start: number; end: number; minutes: number; stayMinutes: number; lat: number; lon: number; name: string | null; subtitle: string; key: string }

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Stays, trips and day groups for [from, to] (inclusive local days), with place names filled in. */
export async function loadTimeline(userId: string, from: string, to: string, tz: string) {
  const now = Date.now();
  const lo = startOfDayMs(addDays(from, -1), tz);
  const hi = startOfDayMs(addDays(to, 2), tz);
  const [pts, visits, trips, places, last] = await Promise.all([
    locationStore.points(userId, lo, hi), locationStore.visits(userId, lo, hi), locationStore.trips(userId, lo, hi),
    locationStore.places(userId), locationStore.lastPointAt(userId),
  ]);
  const { stays, trips: allTrips } = buildTimeline({
    points: pts.filter((p) => p.src === "device"), visits, trips, tz, now,
    stillRecording: last !== null && now - last < 14 * 3600_000,
  });
  const nameOf = (s: Stay) => {
    const key = placeKey(s.lat, s.lon);
    const p = places[key];
    return { key, name: p?.name ?? s.name ?? null, subtitle: p ? p.subtitle : s.address ?? "" };
  };
  const days = new Map<string, DayJson>();
  const put = (date: string, item: DayJson["items"][number]) => {
    if (date < from || date > to) return;
    const d = days.get(date) ?? { date, items: [], placeMinutes: 0 };
    d.items.push(item);
    if (item.kind === "stay" && !item.isHome) d.placeMinutes += item.minutes;
    days.set(date, d);
  };
  for (const s of stays) put(dayOf(s.start, tz), { kind: "stay", id: s.id, start: s.start, end: s.end, minutes: s.minutes, lat: s.lat, lon: s.lon, isHome: s.isHome, src: s.src, ...nameOf(s) });
  for (const t of allTrips as Trip[]) put(dayOf(t.start, tz), { kind: "trip", id: t.id, start: t.start, end: t.end, minutes: t.minutes, meters: Math.round(t.meters), activity: t.activity ?? null });
  const list = Array.from(days.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const d of list) d.items.sort((a, b) => a.start - b.start);
  return { days: list, stays, nameOf };
}

/** Proposed time entries from the last `days` days of stays. */
export async function loadSuggestions(userId: string, days: number, tz: string): Promise<SuggestionJson[]> {
  const today = dayOf(Date.now(), tz);
  const from = addDays(today, -days);
  const { stays, nameOf } = await loadTimeline(userId, from, today, tz);
  const entries = await dataStore.getTimeEntries({ userId, startDate: from });
  const logged: Record<string, number> = {};
  for (const e of entries) logged[e.date] = (logged[e.date] ?? 0) + e.durationMinutes;
  const out = suggest(stays, logged, await locationStore.dismissed(userId), tz, from);
  return out.map((x) => ({
    id: x.stay.id, date: x.date, start: x.stay.start, end: x.stay.end, minutes: x.minutes, stayMinutes: x.stay.minutes,
    lat: x.stay.lat, lon: x.stay.lon, ...nameOf(x.stay),
  }));
}

export const zoneFrom = (url: URL) => safeZone(url.searchParams.get("tz"));
