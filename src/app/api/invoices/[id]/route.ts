import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const inv = await dataStore.getInvoice(params.id);
  if (!inv) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: inv });
}

/** Deletes an invoice: removes the record and marks its time as not invoiced again. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  if (!(await dataStore.deleteInvoice(params.id))) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
