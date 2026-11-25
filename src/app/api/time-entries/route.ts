import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";
import { checkDate, checkEntryText, checkMinutes, checkNotes } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    // Engineers only ever see their own entries here; accountants/admins can look at anyone.
    // (The held-time list is shared, like the workbook's HELD TIME sheet.)
    const userId = isManager(g.user) || searchParams.get("held") === "true" ? searchParams.get("userId") || undefined : g.user.id;
    const flag = (k: string) => (searchParams.get(k) !== null ? searchParams.get(k) === "true" : undefined);

    const entries = await dataStore.getTimeEntries({
      startDate,
      endDate,
      customerId,
      userId,
      isBillable: flag("billable"),
      isInvoiced: flag("invoiced"),
      isHeld: flag("held"),
    });
    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error("Failed to fetch time entries:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const body = await request.json();
    const { userId, customerId, date, durationMinutes, notes, isLumpSum, partsNote, internalNote, contractPo, isBillable, isHeld } = body;

    if (!userId || !date || durationMinutes === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields (userId, date, durationMinutes)" }, { status: 400 });
    }
    if (!isManager(g.user) && userId !== g.user.id) {
      return NextResponse.json({ success: false, error: "You can only log time for yourself." }, { status: 403 });
    }
    const user = (await dataStore.getUsers()).find((u) => u.id === userId);
    const cust = customerId ? (await dataStore.getCustomers()).find((c) => c.id === customerId) : undefined;
    if (!user || (customerId && !cust)) {
      return NextResponse.json({ success: false, error: "Unknown " + (!user ? "person" : "customer") }, { status: 400 });
    }
    const bad = checkMinutes(durationMinutes, Boolean(isLumpSum)) || checkDate(date) || checkNotes(notes) || checkEntryText(body);
    if (bad) return NextResponse.json({ success: false, error: bad }, { status: 400 });

    const entry = await dataStore.createTimeEntry({
      userId,
      customerId: cust?.id ?? "",
      date,
      durationMinutes: Number(durationMinutes),
      notes: notes || "",
      isLumpSum: Boolean(isLumpSum),
      partsNote: partsNote || "",
      internalNote: internalNote || "",
      contractPo: contractPo || "",
      isBillable: isBillable !== undefined ? Boolean(isBillable) : true,
      isHeld: Boolean(isHeld),
    });
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create time entry:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
