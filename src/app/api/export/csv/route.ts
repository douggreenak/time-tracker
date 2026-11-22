import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { generateTimeTrackingCSV, ExportableTimeEntry } from "@/lib/quickbooks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

    const exportable: ExportableTimeEntry[] = entries.map((e) => ({
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

    const csvContent = generateTimeTrackingCSV(exportable);
    const dateStamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `TimeEntries_Export_${dateStamp}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("CSV Export Error:", error);
    return NextResponse.json({ success: false, error: "Failed to export CSV" }, { status: 500 });
  }
}
