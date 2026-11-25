import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";
import { planImport, readUpload } from "@/lib/import-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Adds the time from an uploaded workbook (old files included), skipping anything already here. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const form = await request.formData();
    const up = await readUpload(form);
    if (!up.ok) return NextResponse.json({ success: false, error: up.error }, { status: 400 });
    let mapping: Record<string, string> = {};
    try {
      mapping = JSON.parse(String(form.get("mapping") ?? "{}"));
    } catch {
      return NextResponse.json({ success: false, error: "Bad request." }, { status: 400 });
    }
    const users = await dataStore.getUsers();
    const known = new Set(users.map((u) => u.id));
    const heldUserId = String(form.get("heldUserId") || g.user.id);
    for (const id of [...Object.values(mapping).filter(Boolean), heldUserId]) {
      if (!known.has(id)) return NextResponse.json({ success: false, error: "Unknown person." }, { status: 400 });
      if (!isManager(g.user) && id !== g.user.id) return NextResponse.json({ success: false, error: "You can only import your own time." }, { status: 403 });
    }
    const { plan, toInsert, listRows } = await planImport(
      up.parsed,
      { mapping, heldUserId, includeHeld: form.get("includeHeld") === "true", includeLists: form.get("includeLists") === "true" },
      users
    );
    if (toInsert.length > 20000) return NextResponse.json({ success: false, error: "That's too many rows at once. Import one year at a time." }, { status: 400 });

    const ids = await dataStore.ensureCustomers(toInsert.map((r) => r.customer).concat(listRows.map((r) => r.customer).filter(Boolean)));
    const added = await dataStore.insertEntries(
      toInsert.map(({ customer, minutes, ...r }) => ({ ...r, customerId: ids.get(customer.trim().toLowerCase()) ?? null, durationMinutes: minutes }))
    );
    const lists = await dataStore.insertBillingItems(listRows);
    return NextResponse.json({
      success: true,
      data: {
        added,
        lists,
        skipped: plan.sheets.reduce((n, s) => n + s.duplicateRows, 0),
        customersCreated: plan.newCustomers.length,
      },
    });
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json({ success: false, error: "The import failed part-way. Run it again — rows already added are skipped." }, { status: 500 });
  }
}
