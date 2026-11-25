import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";
import type { InvoiceData } from "@/lib/invoice";
import { buildInvoiceWorkbook } from "@/lib/invoice-excel";

export const dynamic = "force-dynamic";

/** A saved invoice as an Excel sheet, exactly as it was when it was recorded. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const inv = await dataStore.getInvoice(params.id);
  if (!inv?.snapshot) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  const file = await buildInvoiceWorkbook([inv.snapshot as InvoiceData]);
  const safe = inv.customerName.replace(/[^A-Za-z0-9]+/g, "_");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Invoice_${safe}_${inv.dateFrom}_to_${inv.dateTo}.xlsx"`,
      "Cache-Control": "no-cache",
    },
  });
}
