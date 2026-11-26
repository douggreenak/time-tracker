import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { locationStore } from "@/db/locations";

export const dynamic = "force-dynamic";
const MAX_BATCH = 5000;

/** The phone uploads recorded positions here: { points: [{ t: epochMs, lat, lon, acc }] }. Repeats are ignored. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const body = await request.json();
    const list: unknown[] = Array.isArray(body?.points) ? body.points : [];
    if (list.length > MAX_BATCH) return NextResponse.json({ success: false, error: `Send at most ${MAX_BATCH} points at a time.` }, { status: 400 });
    const now = Date.now();
    const points = list.flatMap((p: any) => {
      const t = Number(p?.t), lat = Number(p?.lat), lon = Number(p?.lon);
      const ok = Number.isFinite(t) && t > 946684800000 && t < now + 86400_000 && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && p?.lat != null && p?.lon != null;
      return ok ? [{ t, lat, lon, acc: Number.isFinite(Number(p.acc)) ? Number(p.acc) : null }] : [];
    });
    await locationStore.addPoints(g.user.id, points);
    return NextResponse.json({ success: true, data: { received: list.length, stored: points.length } });
  } catch (error) {
    console.error("Failed to store location points:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
