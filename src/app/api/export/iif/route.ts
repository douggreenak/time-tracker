import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";
import { generateQuickBooksIIF, ExportableTimeEntry } from "@/lib/quickbooks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await requireUser({ manager: true });
  if (!g.ok) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const customerId = searchParams.get("customerId") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const status = searchParams.get("status") || undefined;

    const entries = await dataStore.getTimeEntries({
      startDate,
      endDate,
      customerId,
      userId,
      status,
    });

    // QuickBooks needs both a customer/job and a service item on every TIMEACT line. Entries without them
    // (customer and task are optional in this app) would import wrongly or fail, so they're left out.
    const complete = entries.filter((e) => e.customerName && e.serviceItemName);
    const skipped = entries.length - complete.length;
    const exportable: ExportableTimeEntry[] = complete.map((e) => ({
      id: e.id,
      date: e.date,
      employeeName: e.userName,
      customerName: e.customerName,
      jobName: e.jobName,
      serviceItemName: e.serviceItemName,
      durationMinutes: e.durationMinutes,
      locationType: e.locationType,
      locationName: e.locationName,
      notes: e.notes,
      isBillable: e.isBillable,
      status: e.status,
    }));

    const iifContent = generateQuickBooksIIF(exportable);
    const dateStamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `QuickBooks_Timer_${dateStamp}.iif`;

    return new Response(iifContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
        "X-Skipped-Entries": String(skipped),
      },
    });
  } catch (error) {
    console.error("IIF Export Error:", error);
    return NextResponse.json({ success: false, error: "Failed to export IIF" }, { status: 500 });
  }
}
