import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const b = await request.json();
    const u: { customer?: string; description?: string; amount?: number; notes?: string } = {};
    if (typeof b.customer === "string") u.customer = b.customer.slice(0, 255);
    if (typeof b.description === "string") u.description = b.description.slice(0, 2000);
    if (typeof b.notes === "string") u.notes = b.notes.slice(0, 2000);
    if (b.amount !== undefined) {
      const n = Number(b.amount);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ success: false, error: "Amount must be a number." }, { status: 400 });
      u.amount = n;
    }
    const item = await dataStore.updateBillingItem(params.id, u);
    if (!item) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: item });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser({ manager: true });
  if (!g.ok) return g.res;
  if (!(await dataStore.deleteBillingItem(params.id))) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
