import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildDataWorkbook } from "@/lib/workbook";
import { exportData, XLSX } from "@/lib/snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Download the data in the workbook format right now: everything, or `?year=2026`. */
export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const year = new URL(request.url).searchParams.get("year") || undefined;
  if (year && !/^\d{4}$/.test(year)) return NextResponse.json({ success: false, error: "Bad year." }, { status: 400 });
  const file = await buildDataWorkbook(await exportData(year));
  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="TimeTrack_${year ? `Year_${year}` : "Full"}_${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-cache" },
  });
}
