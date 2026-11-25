import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildInvoices, parseBillingRequest } from "@/lib/billing-server";

export const dynamic = "force-dynamic";

/** Builds the invoice sheets for a date range, like the macro's "create customer invoice sheets" (nothing is saved). */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const parsed = parseBillingRequest(await request.json());
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    return NextResponse.json({ success: true, data: await buildInvoices(parsed.req) });
  } catch (error) {
    console.error("Invoice preview failed:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
