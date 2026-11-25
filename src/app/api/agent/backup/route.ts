import { NextResponse } from "next/server";
import { exportBackup } from "@/db/backup";
import { requireAgent, touchAgent } from "@/lib/agent";
import { exportData } from "@/lib/snapshots";
import { buildDataWorkbook } from "@/lib/workbook";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The agent downloads a backup: ?format=json (full restore file) or ?format=xlsx (workbook layout). */
export async function GET(request: Request) {
  const bad = await requireAgent(request);
  if (bad) return bad;
  await touchAgent(request);
  const format = new URL(request.url).searchParams.get("format");
  try {
    if (format === "json")
      return new Response(JSON.stringify(await exportBackup()), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    if (format === "xlsx") {
      const file = await buildDataWorkbook(await exportData(), "TimeTrack backup");
      return new Response(new Uint8Array(file), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ success: false, error: "format must be json or xlsx" }, { status: 400 });
  } catch (e) {
    console.error("Agent backup failed:", e);
    return NextResponse.json({ success: false, error: "Couldn't build the backup." }, { status: 500 });
  }
}
