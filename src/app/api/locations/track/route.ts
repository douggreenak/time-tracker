import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { locationStore } from "@/db/locations";
import { addDays, startOfDayMs } from "@/lib/location";
import { isDay, zoneFrom } from "@/lib/location-server";

export const dynamic = "force-dynamic";
const MAX_POINTS = 6000;

/** The recorded path for map drawing: ?from=2026-03-01&to=2026-03-02&tz=... → [[t, lat, lon], ...] (thinned if long). */
export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const url = new URL(request.url);
  const tz = zoneFrom(url);
  const from = url.searchParams.get("from") ?? "", to = url.searchParams.get("to") ?? from;
  if (!isDay(from) || !isDay(to) || from > to || Date.parse(to) - Date.parse(from) > 93 * 86400_000)
    return NextResponse.json({ success: false, error: "Give from and to dates (3 months at most)." }, { status: 400 });
  const rows = await locationStore.points(g.user.id, startOfDayMs(from, tz), startOfDayMs(addDays(to, 1), tz));
  const step = Math.max(1, Math.ceil(rows.length / MAX_POINTS));
  const pts = rows.filter((_, i) => i % step === 0).map((p) => [p.t, Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6]);
  return NextResponse.json({ success: true, data: { points: pts, total: rows.length } });
}
