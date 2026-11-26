import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { locationStore } from "@/db/locations";

export const dynamic = "force-dynamic";

/** "Not work": hides one suggestion. { stayId, undo?: true } */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const body = await request.json().catch(() => null);
  const id = typeof body?.stayId === "string" ? body.stayId.slice(0, 80) : "";
  if (!id) return NextResponse.json({ success: false, error: "stayId is required." }, { status: 400 });
  await locationStore.dismiss(g.user.id, id, body?.undo === true);
  return NextResponse.json({ success: true });
}
