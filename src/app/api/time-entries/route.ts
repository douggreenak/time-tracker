import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";
import { checkDate, checkMinutes, checkNotes, STATUSES } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    // Engineers only ever see their own entries; accountants/admins can look at anyone.
    const userId = isManager(g.user) ? searchParams.get("userId") || undefined : g.user.id;
    const status = searchParams.get("status") || undefined;
    const billableParam = searchParams.get("billable");
    const isBillable = billableParam !== null ? billableParam === "true" : undefined;

    const entries = await dataStore.getTimeEntries({
      startDate,
      endDate,
      customerId,
      userId,
      status,
      isBillable,
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

    const {
      userId,
      customerId,
      jobId,
      serviceItemId,
      date,
      durationMinutes,
      locationType,
      locationName,
      latitude,
      longitude,
      notes,
      isBillable,
      status,
    } = body;

    if (!userId || !customerId || !serviceItemId || !date || durationMinutes === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (userId, customerId, serviceItemId, date, durationMinutes)" },
        { status: 400 }
      );
    }

    const customers = await dataStore.getCustomers();
    const cust = customers.find((c) => c.id === customerId);
    const job = cust?.jobs.find((j) => j.id === jobId);

    const services = await dataStore.getServiceItems();
    const srv = services.find((s) => s.id === serviceItemId);

    const users = await dataStore.getUsers();
    const user = users.find((u) => u.id === userId);

    if (!isManager(g.user) && userId !== g.user.id) {
      return NextResponse.json({ success: false, error: "You can only log time for yourself." }, { status: 403 });
    }
    if (!cust || !srv || !user) {
      return NextResponse.json(
        { success: false, error: "Unknown " + (!user ? "engineer" : !cust ? "customer" : "service item") },
        { status: 400 }
      );
    }
    const bad = checkMinutes(durationMinutes) || checkDate(date) || checkNotes(notes);
    if (bad) return NextResponse.json({ success: false, error: bad }, { status: 400 });
    // Only an accountant/admin can create an entry that is already approved or exported.
    const newStatus = isManager(g.user) && (STATUSES as readonly string[]).includes(status) ? status : "submitted";

    const newEntry = await dataStore.createTimeEntry({
      userId,
      userName: user?.name || "Engineer",
      customerId,
      customerName: cust?.name || "Customer",
      jobId: job?.id || null,
      jobName: job?.name || null,
      serviceItemId,
      serviceItemName: srv?.name || "Service Item",
      date,
      durationMinutes: Number(durationMinutes),
      locationType: locationType || "office",
      locationName: locationName || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      notes: notes || "",
      isBillable: isBillable !== undefined ? Boolean(isBillable) : srv?.defaultBillable ?? true,
      status: newStatus,
    });

    return NextResponse.json({ success: true, data: newEntry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create time entry:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
