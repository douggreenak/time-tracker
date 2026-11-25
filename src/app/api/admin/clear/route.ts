import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { loginThrottle, recordLogin, requireUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { buildDataWorkbook } from "@/lib/workbook";
import { exportData } from "@/lib/snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CLEAR_PHRASE = "DELETE ALL DATA";
const PARTS = ["entries", "invoices", "lists", "customers", "people", "saved"];

/**
 * Deletes the groups the admin ticked (time, invoices, lists, customers, people, saved spreadsheets). Admin only, and it needs the admin's own password
 * and the typed phrase. A spreadsheet of everything is saved first; if that can't be saved, nothing is deleted.
 * Saved spreadsheets themselves are kept, so the safety copy survives.
 */
export async function POST(request: Request) {
  const g = await requireUser({ admin: true });
  if (!g.ok) return g.res;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== CLEAR_PHRASE) return NextResponse.json({ success: false, error: `Type ${CLEAR_PHRASE} to confirm.` }, { status: 400 });
    const parts = new Set<string>(Array.isArray(body.parts) ? body.parts.map(String) : []);
    if (!parts.size || Array.from(parts).some((p) => !PARTS.includes(p))) return NextResponse.json({ success: false, error: "Choose what to delete." }, { status: 400 });
    // Customers and people own the time entries (deleting them deletes their time), so those go too.
    if (parts.has("customers") || parts.has("people")) parts.add("entries");
    const wait = loginThrottle(g.user.id);
    if (wait) return NextResponse.json({ success: false, error: `Too many wrong passwords. Try again in ${wait} seconds.` }, { status: 429 });
    const rec = await dataStore.getUserForAuth(g.user.id);
    const ok = !!rec && typeof body.password === "string" && (await verifyPassword(body.password, rec.passwordHash));
    recordLogin(g.user.id, ok);
    if (!ok) return NextResponse.json({ success: false, error: "Wrong password. Nothing was deleted." }, { status: 403 });

    // 1. Save a spreadsheet of everything (kept after the clear).
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const file = await buildDataWorkbook(await exportData(), `TimeTrack before clearing ${stamp}`);
    const fileName = `TimeTrack_before_clearing_${stamp.replace(/[ :]/g, "-")}.xlsx`;
    await dataStore.putSavedExport("cleared", stamp, fileName, file);
    if (!(await dataStore.hasSavedExport("cleared", stamp))) throw new Error("safety copy was not saved");

    // 2. Delete.
    await dataStore.clearParts(parts, { kind: "cleared", period: stamp });
    return NextResponse.json({ success: true, data: { savedAs: fileName, deleted: Array.from(parts), signedOut: parts.has("people") } });
  } catch (error) {
    console.error("Clear all data failed:", error);
    return NextResponse.json({ success: false, error: "Couldn't clear the data. If it didn't finish, run it again." }, { status: 500 });
  }
}
