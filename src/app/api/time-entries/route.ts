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

    // Customer, project and task are all optional.
    if (!userId || !date || durationMinutes === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (userId, date, durationMinutes)" },
        { status: 400 }
      );
    }

    const customers = await dataStore.getCustomers();
    const cust = customerId ? customers.find((c) => c.id === customerId) : undefined;
    const job = cust?.jobs.find((j) => j.id === jobId);

    const services = await dataStore.getServiceItems();
    const srv = serviceItemId ? services.find((s) => s.id === serviceItemId) : undefined;

    const users = await dataStore.getUsers();
    const user = users.find((u) => u.id === userId);

    if (!isManager(g.user) && userId !== g.user.id) {
      return NextResponse.json({ success: false, error: "You can only log time for yourself." }, { status: 403 });
    }
    if (!user || (customerId && !cust) || (serviceItemId && !srv)) {
      return NextResponse.json(
        { success: false, error: "Unknown " + (!user ? "engineer" : !cust ? "customer" : "task") },
        { status: 400 }
      );
    }
    if (jobId && !job) {
      return NextResponse.json({ success: false, error: "That project doesn't belong to the customer." }, { status: 400 });
    }
    const bad = checkMinutes(durationMinutes) || checkDate(date) || checkNotes(notes);
    if (bad) return NextResponse.json({ success: false, error: bad }, { status: 400 });
    // Only an accountant/admin can create an entry that is already approved or exported.
    // New time starts as a draft; the engineer submits it (selected rows or a whole week) when it's ready.
    // Only managers can create already-approved/exported rows (e.g. when restoring a deleted one).
    const allowed: readonly string[] = isManager(g.user) ? STATUSES : ["draft", "submitted"];
    const newStatus = allowed.includes(status) ? status : "draft";

    const newEntry = await dataStore.createTimeEntry({
      userId,
      userName: user?.name || "Engineer",
      customerId: cust?.id ?? "",
      customerName: cust?.name ?? "",
      jobId: job?.id || null,
      jobName: job?.name || null,
      serviceItemId: srv?.id ?? "",
      serviceItemName: srv?.name ?? "",
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
