import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { exportBackup, importBackup, validateBackup } from "@/db/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Download everything in the app as one file (admin only). It includes sign-in password hashes, so keep it private. */
export async function GET() {
  const g = await requireUser({ admin: true });
  if (!g.ok) return g.res;
  try {
    const data = await exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="TimeTrack_backup_${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Backup export failed:", e);
    return NextResponse.json({ success: false, error: "Couldn't create the backup." }, { status: 500 });
  }
}

/** Replace ALL data with a backup file (admin only). Body: { confirm: "RESTORE", backup: <file contents> }. */
export async function POST(request: Request) {
  const g = await requireUser({ admin: true });
  if (!g.ok) return g.res;
  try {
    const body = await request.json();
    if (body?.confirm !== "RESTORE") return NextResponse.json({ success: false, error: "Type RESTORE to confirm." }, { status: 400 });
    try {
      validateBackup(body.backup);
    } catch (e) {
      return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Invalid backup." }, { status: 400 });
    }
    const counts = await importBackup(body.backup);
    return NextResponse.json({ success: true, data: counts });
  } catch (e) {
    console.error("Backup restore failed:", e);
    return NextResponse.json({ success: false, error: "The restore failed and nothing was changed. The file may be damaged or from a different setup." }, { status: 500 });
  }
}
