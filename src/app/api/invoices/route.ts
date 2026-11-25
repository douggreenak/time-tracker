import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";
import { buildInvoices, parseBillingRequest } from "@/lib/billing-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    return NextResponse.json({ success: true, data: await dataStore.getInvoices() });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

/** Records the invoices (what "Mark as invoiced" does): saves a snapshot of each and marks its time as invoiced. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const parsed = parseBillingRequest(await request.json());
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const invoices = await buildInvoices(parsed.req);
    if (!invoices.length) return NextResponse.json({ success: false, error: "There's no billable time for those customers in that range." }, { status: 404 });
    const saved = [];
    for (const inv of invoices) {
      saved.push(
        await dataStore.createInvoice({
          customerId: inv.customerId,
          customerName: inv.customerName,
          dateFrom: inv.dateFrom,
          dateTo: inv.dateTo,
          total: inv.amountDue,
          snapshot: inv,
          createdBy: g.user.name,
          entryIds: inv.entryIds,
        })
      );
    }
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error("Recording invoices failed:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
