import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildInvoices, parseBillingRequest } from "@/lib/billing-server";
import { buildInvoiceWorkbook } from "@/lib/invoice-excel";

export const dynamic = "force-dynamic";

/** Downloads the invoice sheets as one Excel workbook, one sheet per customer, in the macro's layout. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const parsed = parseBillingRequest(await request.json());
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const invoices = await buildInvoices(parsed.req);
    if (!invoices.length) return NextResponse.json({ success: false, error: "There's no billable time for those customers in that range." }, { status: 404 });
    const file = await buildInvoiceWorkbook(invoices);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Invoices_${parsed.req.from}_to_${parsed.req.to}.xlsx"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Invoice Excel failed:", error);
    return NextResponse.json({ success: false, error: "Couldn't build the Excel file." }, { status: 500 });
  }
}
