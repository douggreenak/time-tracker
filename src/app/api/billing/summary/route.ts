import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";
import { checkDate } from "@/lib/validate";
import { billableEntries, buildInvoice } from "@/lib/invoice";

export const dynamic = "force-dynamic";

/**
 * The workbook's MACRO DATA sheet: for each customer, when they were last invoiced, whether there is new time
 * waiting, and what an invoice for the chosen dates would come to.
 */
export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    const includeInvoiced = searchParams.get("includeInvoiced") === "true";
    const bad = checkDate(from) || checkDate(to);
    if (bad) return NextResponse.json({ success: false, error: bad }, { status: 400 });
    if (from > to) return NextResponse.json({ success: false, error: "The start date is after the end date." }, { status: 400 });

    const [entries, users, customers] = await Promise.all([dataStore.getTimeEntries(), dataStore.getUsers(), dataStore.getCustomers()]);
    const waiting = billableEntries(entries); // everything billable that hasn't been invoiced yet
    const usable = billableEntries(entries, { includeInvoiced });
    const rows = customers
      .map((c) => {
        const inv = buildInvoice(usable, users, c, from, to);
        const unbilled = waiting.filter((e) => e.customerId === c.id);
        return {
          customerId: c.id,
          customerName: c.name,
          isActive: c.isActive,
          lastInvoiceDate: c.lastInvoiceDate ?? null,
          newHours: unbilled.length > 0,
          unbilledHours: Math.round(unbilled.reduce((n, e) => n + e.durationMinutes, 0) / 6) / 10,
          hoursInRange: Math.round(inv.summary.reduce((n, s) => n + s.hours, 0) * 10) / 10,
          entriesInRange: inv.lines.length,
          amountInRange: inv.laborTotal,
        };
      })
      .filter((r) => r.entriesInRange > 0 || r.newHours)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Billing summary failed:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
