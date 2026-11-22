import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const userId = searchParams.get("userId") || undefined;
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
      status: status || "submitted",
    });

    return NextResponse.json({ success: true, data: newEntry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create time entry:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
