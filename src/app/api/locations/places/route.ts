import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { locationStore } from "@/db/locations";

export const dynamic = "force-dynamic";

const clean = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const KEY = /^-?\d{1,3}\.\d{3},-?\d{1,3}\.\d{3}$/;

/**
 * Names for places. { places: [{ key, name, subtitle }], auto?: true }.
 * `auto` is what the phone's map lookup found (it never overrides a name someone typed); without it the name is a person's own.
 */
export async function PUT(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const body = await request.json().catch(() => null);
  const list = (Array.isArray(body?.places) ? body.places : []).slice(0, 500)
    .map((p: any) => ({ key: clean(p?.key, 40), name: clean(p?.name, 255), subtitle: clean(p?.subtitle, 500) }))
    .filter((p: { key: string; name: string }) => KEY.test(p.key) && p.name);
  if (!list.length) return NextResponse.json({ success: false, error: "Give a place key and a name." }, { status: 400 });
  await locationStore.setPlaces(g.user.id, list, body?.auto !== true);
  return NextResponse.json({ success: true });
}
