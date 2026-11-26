import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { locationStore } from "@/db/locations";
import { parseArcItems } from "@/lib/location";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Brings in Arc Timeline data. The browser (or phone) opens the export file, then sends its `timelineItems`
 * a few hundred at a time: { items: [...] }. Repeating a file adds nothing twice.
 */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const body = await request.json();
    if (!Array.isArray(body?.items) || body.items.length > 2000) return NextResponse.json({ success: false, error: "Send up to 2000 timeline items at a time." }, { status: 400 });
    const parsed = parseArcItems(body.items);
    const stored = await locationStore.importArc(g.user.id, parsed);
    return NextResponse.json({ success: true, data: { ...stored, skipped: parsed.skipped, readVisits: parsed.visits.length, readTrips: parsed.trips.length } });
  } catch (error) {
    console.error("Failed to import Arc data:", error);
    return NextResponse.json({ success: false, error: "Could not read that data." }, { status: 400 });
  }
}
