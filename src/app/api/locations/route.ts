import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { locationStore } from "@/db/locations";
import { addDays, dayOf } from "@/lib/location";
import { isDay, loadSuggestions, loadTimeline, zoneFrom } from "@/lib/location-server";

export const dynamic = "force-dynamic";

/** The signed-in person's own timeline: ?from=2026-03-01&to=2026-03-14&tz=America/Anchorage&suggest=14 */
export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const url = new URL(request.url);
    const tz = zoneFrom(url);
    const today = dayOf(Date.now(), tz);
    const to = url.searchParams.get("to") ?? today;
    const from = url.searchParams.get("from") ?? addDays(to, -13);
    if (!isDay(from) || !isDay(to) || from > to) return NextResponse.json({ success: false, error: "Dates must look like 2026-03-31." }, { status: 400 });
    if (Date.parse(to) - Date.parse(from) > 93 * 86400_000) return NextResponse.json({ success: false, error: "Ask for 3 months or less at a time." }, { status: 400 });
    const suggestDays = Math.min(60, Math.max(0, Number(url.searchParams.get("suggest") ?? 0) || 0));
    const [tl, suggestions, counts, last] = await Promise.all([
      loadTimeline(g.user.id, from, to, tz),
      suggestDays ? loadSuggestions(g.user.id, suggestDays, tz) : Promise.resolve([]),
      locationStore.counts(g.user.id),
      locationStore.lastPointAt(g.user.id),
    ]);
    return NextResponse.json({ success: true, data: { from, to, tz, days: tl.days, suggestions, counts, lastPointAt: last } });
  } catch (error) {
    console.error("Failed to load location timeline:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes the signed-in person's location data: ?src=all|device|arc */
export async function DELETE(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const src = new URL(request.url).searchParams.get("src") ?? "all";
  if (src !== "all" && src !== "device" && src !== "arc") return NextResponse.json({ success: false, error: "src must be all, device or arc." }, { status: 400 });
  await locationStore.erase(g.user.id, src);
  return NextResponse.json({ success: true });
}
