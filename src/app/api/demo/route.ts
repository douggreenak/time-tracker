import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";
import { storageMode } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    return NextResponse.json({ success: true, data: { isDemo: await dataStore.isDemo(), storage: storageMode() } });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

/** Removes the sample data (and everything else) so the database starts empty. Only allowed while demo data is loaded. */
export async function DELETE() {
  const g = await requireUser({ manager: true });
  if (!g.ok) return g.res;
  try {
    if (!(await dataStore.isDemo())) {
      return NextResponse.json({ success: false, error: "No demo data to clear" }, { status: 409 });
    }
    await dataStore.clearAllData();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
