// Location history logic, shared by the API routes: turning raw points into stays and trips, suggesting work time,
// and reading Arc Timeline exports. Pure functions (no database), so they are easy to reason about.

export interface Pt { t: number; lat: number; lon: number; acc?: number | null }

export interface Stay {
  id: string;
  start: number; // epoch ms
  end: number;
  lat: number;
  lon: number;
  minutes: number;
  isHome: boolean;
  src: "device" | "arc";
  /** The source's own title (Arc names its visits). */
  name?: string | null;
  address?: string | null;
}
export interface Trip { id: string; start: number; end: number; meters: number; minutes: number; activity?: string | null }
export interface VisitRow { id: string; startMs: number; endMs: number; lat: number; lon: number; name: string | null; address: string | null; src: string }
export interface TripRow { id: string; startMs: number; endMs: number; meters: number; activity: string | null; src: string }

export const placeKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

const MIN_STAY = 10; // minutes shown on the timeline
export const MIN_WORK_STAY = 20; // minutes before we suggest logging it
const GAP_MS = 14 * 3600_000; // updates pause while you are still, so long gaps at one spot are normal
const RADIUS_M = 150;
const HOUR = 3600_000;

export function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---- Time zones: days are the person's local days, so the client says which zone it is in. ----

export function safeZone(tz: string | null | undefined): string {
  try {
    if (tz) new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz || "UTC";
  } catch {
    return "UTC";
  }
}
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(tz, f);
  }
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}
/** "2026-03-31" for a moment, in the given zone. */
export const dayOf = (ms: number, tz: string) => { const o = parts(ms, tz); return `${o.year}-${o.month}-${o.day}`; };
export const hourOf = (ms: number, tz: string) => Number(parts(ms, tz).hour);
/** Epoch ms of local midnight starting `day` in `tz`. */
export function startOfDayMs(day: string, tz: string): number {
  const target = Date.parse(`${day}T00:00:00Z`);
  let ms = target;
  for (let i = 0; i < 3; i++) { // converges in one or two steps, including across a daylight-saving change
    const o = parts(ms, tz);
    ms -= Date.parse(`${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}:${o.second}Z`) - target;
  }
  return ms;
}
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

// ---- Stays from raw points ----

/**
 * Groups consecutive points that stay within 150 m into stays. `stillRecording` means the newest point is "now-ish",
 * so a stay that has not ended yet runs up to the current time.
 */
export function staysFromPoints(points: Pt[], now: number, stillRecording: boolean): Omit<Stay, "isHome">[] {
  const out: Omit<Stay, "isHome">[] = [];
  let i = 0;
  while (i < points.length) {
    const a = points[i];
    let j = i;
    let sumLat = a.lat, sumLon = a.lon, n = 1;
    while (j + 1 < points.length) {
      const b = points[j + 1];
      if (b.t - points[j].t > GAP_MS) break;
      if (distanceM(a.lat, a.lon, b.lat, b.lon) > RADIUS_M) break;
      j++; sumLat += b.lat; sumLon += b.lon; n++;
    }
    let endT = points[j].t;
    if (j + 1 < points.length && points[j + 1].t - endT <= GAP_MS) endT = points[j + 1].t; // left when the next point arrived
    else if (j === points.length - 1 && stillRecording) endT = Math.min(now, endT + 12 * HOUR); // still here
    const minutes = Math.max(0, Math.floor((endT - a.t) / 60000));
    if (minutes >= MIN_STAY) out.push({ id: `${Math.floor(a.t / 1000)}`, start: a.t, end: endT, lat: sumLat / n, lon: sumLon / n, minutes, src: "device" });
    i = j + 1;
  }
  return out;
}

/** Home = a place where at least an hour between midnight and 5 am was spent. */
export function markHome<T extends Omit<Stay, "isHome">>(stays: T[], tz: string): (T & { isHome: boolean })[] {
  const homes: { lat: number; lon: number }[] = [];
  for (const s of stays) {
    let night = 0;
    let day = dayOf(s.start, tz);
    for (let guard = 0; guard < 400; guard++) {
      const w0 = startOfDayMs(day, tz);
      if (w0 >= s.end) break;
      night += Math.max(0, Math.min(s.end, w0 + 5 * HOUR) - Math.max(s.start, w0));
      day = addDays(day, 1);
    }
    if (night >= HOUR && !homes.some((h) => distanceM(h.lat, h.lon, s.lat, s.lon) < 200)) homes.push({ lat: s.lat, lon: s.lon });
  }
  return stays.map((s) => ({ ...s, isHome: homes.some((h) => distanceM(h.lat, h.lon, s.lat, s.lon) < 200) }));
}

/** The movement between two consecutive stays on the same day. */
export function tripBetween(a: Stay, b: Stay, pts: Pt[], tz: string): Trip | null {
  const gap = b.start - a.end;
  if (gap < 120_000 || gap > 4 * HOUR || dayOf(a.start, tz) !== dayOf(b.start, tz)) return null;
  const seg = pts.filter((p) => p.t >= a.end - 60_000 && p.t <= b.start + 60_000);
  let meters = 0;
  for (let k = 1; k < seg.length; k++) meters += distanceM(seg[k - 1].lat, seg[k - 1].lon, seg[k].lat, seg[k].lon);
  if (meters < 300) meters = distanceM(a.lat, a.lon, b.lat, b.lon);
  return { id: `trip-${Math.floor(a.end / 1000)}`, start: a.end, end: b.start, meters, minutes: Math.max(1, Math.floor(gap / 60000)) };
}

export interface TimelineInput {
  points: Pt[]; // device points, oldest first
  visits: VisitRow[];
  trips: TripRow[];
  tz: string;
  now: number;
  stillRecording: boolean;
}

/** All stays and trips for the loaded window: device stays + imported visits (imported ones win where both exist). */
export function buildTimeline({ points, visits, trips, tz, now, stillRecording }: TimelineInput): { stays: Stay[]; trips: Trip[] } {
  const device = markHome(staysFromPoints(points, now, stillRecording), tz);
  const imported: Stay[] = visits.map((v) => ({
    id: `v-${v.id}`, start: v.startMs, end: v.endMs, lat: v.lat, lon: v.lon,
    minutes: Math.max(0, Math.floor((v.endMs - v.startMs) / 60000)), isHome: false, src: v.src === "device" ? "device" : "arc", name: v.name, address: v.address,
  }));
  const overlapsImported = (s: Stay) =>
    imported.some((v) => Math.min(v.end, s.end) - Math.max(v.start, s.start) > 0.5 * (s.end - s.start));
  const keptDevice = device.filter((s) => !overlapsImported(s));
  const all = [...keptDevice, ...markHomeImported(imported, tz)].sort((a, b) => a.start - b.start);

  const out: Trip[] = trips.map((t) => ({ id: `t-${t.id}`, start: t.startMs, end: t.endMs, meters: t.meters, minutes: Math.max(1, Math.floor((t.endMs - t.startMs) / 60000)), activity: t.activity }));
  for (let k = 0; k + 1 < keptDevice.length; k++) {
    const t = tripBetween(keptDevice[k], keptDevice[k + 1], points, tz);
    if (t && !out.some((o) => Math.min(o.end, t.end) - Math.max(o.start, t.start) > 0)) out.push(t);
  }
  return { stays: all, trips: out.sort((a, b) => a.start - b.start) };
}

// Imported visits get the same night-time test as device ones.
function markHomeImported(stays: Stay[], tz: string): Stay[] {
  return markHome(stays, tz);
}

// ---- Suggestions ----

export interface Suggestion { stay: Stay; minutes: number; date: string }

/** Rounded to the nearest quarter hour, at least 15 minutes. */
export const suggestedMinutes = (stayMinutes: number) => Math.max(15, Math.round(stayMinutes / 15) * 15);

/** Stays worth logging: recent, not at home, long enough, not dismissed, and not already covered by time the user entered. */
export function suggest(stays: Stay[], loggedMinutesByDate: Record<string, number>, dismissed: Set<string>, tz: string, from: string): Suggestion[] {
  const covered: Record<string, number> = {};
  const result: Suggestion[] = [];
  for (const s of [...stays].sort((a, b) => a.start - b.start)) {
    const date = dayOf(s.start, tz);
    if (s.isHome || s.minutes < MIN_WORK_STAY || date < from || dismissed.has(s.id)) continue;
    const minutes = suggestedMinutes(s.minutes);
    covered[date] = (covered[date] ?? 0) + minutes;
    if (covered[date] > (loggedMinutesByDate[date] ?? 0)) result.push({ stay: s, minutes, date });
  }
  return result.sort((a, b) => b.stay.start - a.stay.start);
}

// ---- Arc Timeline import ----

export interface ParsedArc {
  visits: { extId: string; startMs: number; endMs: number; lat: number; lon: number; name: string | null; address: string | null }[];
  trips: { extId: string; startMs: number; endMs: number; meters: number; activity: string | null }[];
  points: Pt[];
  skipped: number;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, 255) : null);
const when = (v: unknown): number | null => {
  if (typeof v === "number") return v > 1e11 ? v : v * 1000; // seconds or milliseconds
  if (typeof v !== "string") return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
};
function coords(o: any): { lat: number; lon: number } | null {
  if (!o || typeof o !== "object") return null;
  const lat = num(o.latitude ?? o.lat), lon = num(o.longitude ?? o.lon ?? o.lng);
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

/**
 * Reads the `timelineItems` of an Arc Timeline export (JSON). Visits become stays (with Arc's place names),
 * paths become trips, and the GPS samples inside both become points for the map. Tolerant of missing pieces:
 * anything it can't read is counted in `skipped`.
 */
export function parseArcItems(items: unknown): ParsedArc {
  const res: ParsedArc = { visits: [], trips: [], points: [], skipped: 0 };
  if (!Array.isArray(items)) return res;
  let lastSample = 0;
  for (const raw of items) {
    const it = raw as any;
    const start = when(it?.startDate), end = when(it?.endDate);
    if (!it || typeof it !== "object" || start === null || end === null || end < start) { res.skipped++; continue; }
    const samples: Pt[] = [];
    for (const s of Array.isArray(it.samples) ? it.samples : []) {
      const c = coords(s?.location ?? s);
      const t = when(s?.date ?? s?.timestamp ?? s?.location?.timestamp);
      if (c && t !== null) samples.push({ t, ...c, acc: num(s?.location?.horizontalAccuracy ?? s?.horizontalAccuracy) });
    }
    samples.sort((a, b) => a.t - b.t);
    for (const p of samples) if (p.t - lastSample >= 60_000 || p.t < lastSample) { res.points.push(p); lastSample = p.t; } // one a minute is plenty for a map
    const extId = str(it.itemId) ?? `${start}-${end}`;
    const isVisit = it.isVisit === true || (it.isVisit === undefined && (it.place || it.center));
    if (isVisit) {
      let c = coords(it.center) ?? coords(it.place?.center) ?? coords(it.place);
      if (!c && samples.length) c = { lat: samples.reduce((a, p) => a + p.lat, 0) / samples.length, lon: samples.reduce((a, p) => a + p.lon, 0) / samples.length };
      if (!c) { res.skipped++; continue; }
      const place = it.place && typeof it.place === "object" ? it.place : {};
      res.visits.push({
        extId, startMs: start, endMs: end, ...c,
        name: str(it.customTitle) ?? str(place.name) ?? str(it.placeName) ?? str(it.title),
        address: str(it.streetAddress) ?? str(place.streetAddress) ?? str(place.address),
      });
    } else {
      let meters = num(it.distance) ?? 0;
      if (!meters) for (let k = 1; k < samples.length; k++) meters += distanceM(samples[k - 1].lat, samples[k - 1].lon, samples[k].lat, samples[k].lon);
      res.trips.push({ extId, startMs: start, endMs: end, meters, activity: str(it.manualActivityType) ?? str(it.activityType) });
    }
  }
  return res;
}
