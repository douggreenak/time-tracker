import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";
import { createSnapshot, ensureSnapshots } from "@/lib/snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const g = await requireUser();
  if (!g.ok) return g.res;
  await ensureSnapshots();
  return NextResponse.json({ success: true, data: await dataStore.getSavedExports() });
}

/** Saves a spreadsheet now: { kind: "monthly" } (everything, filed under this month) or { kind: "yearly", year }. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.kind === "yearly") {
      const year = String(body.year ?? "");
      if (!/^\d{4}$/.test(year)) return NextResponse.json({ success: false, error: "Pick a year." }, { status: 400 });
      const r = await createSnapshot("yearly", year);
      return NextResponse.json({ success: true, data: r }, { status: 201 });
    }
    const r = await createSnapshot("monthly", new Date().toISOString().slice(0, 7));
    return NextResponse.json({ success: true, data: r }, { status: 201 });
  } catch (error) {
    console.error("Saving the spreadsheet failed:", error);
    return NextResponse.json({ success: false, error: "Couldn't save the spreadsheet." }, { status: 500 });
  }
}
