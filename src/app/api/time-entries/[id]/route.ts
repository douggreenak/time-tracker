import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";
import { checkDate, checkEntryText, checkMinutes, checkNotes } from "@/lib/validate";

export const dynamic = "force-dynamic";

const FIELDS = ["customerId", "date", "durationMinutes", "notes", "isLumpSum", "partsNote", "internalNote", "contractPo", "isBillable", "isInvoiced", "isHeld", "userId"] as const;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const entry = await dataStore.getTimeEntryById(params.id);
  if (!entry) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  if (!isManager(g.user) && entry.userId !== g.user.id) {
    return NextResponse.json({ success: false, error: "That entry belongs to someone else." }, { status: 403 });
  }
  return NextResponse.json({ success: true, data: entry });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const current = await dataStore.getTimeEntryById(params.id);
  try {
    const body = await request.json();
    if (current && !isManager(g.user) && current.userId !== g.user.id) {
      return NextResponse.json({ success: false, error: "That entry belongs to someone else." }, { status: 403 });
    }
    if (!isManager(g.user)) delete body.userId; // you can't hand your time to someone else
    if (!isManager(g.user)) delete body.isInvoiced; // only an accountant or admin changes what has been invoiced
    const lump = body.isLumpSum !== undefined ? Boolean(body.isLumpSum) : Boolean(current?.isLumpSum);
    const bad =
      (body.durationMinutes !== undefined && checkMinutes(body.durationMinutes, lump)) ||
      (body.date !== undefined && checkDate(body.date)) ||
      checkNotes(body.notes) ||
      checkEntryText(body);
    if (bad) return NextResponse.json({ success: false, error: bad }, { status: 400 });
    if (body.customerId && !(await dataStore.getCustomers()).some((c) => c.id === body.customerId)) {
      return NextResponse.json({ success: false, error: "Unknown customer." }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    for (const k of FIELDS) if (body[k] !== undefined) patch[k] = body[k];
    const updated = await dataStore.updateTimeEntry(params.id, patch);
    if (!updated) return NextResponse.json({ success: false, error: "Time entry not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const current = await dataStore.getTimeEntryById(params.id);
  if (current && !isManager(g.user) && current.userId !== g.user.id) {
    return NextResponse.json({ success: false, error: "That entry belongs to someone else." }, { status: 403 });
  }
  try {
    if (current?.isInvoiced && !isManager(g.user)) {
      return NextResponse.json({ success: false, error: "That time is already on an invoice, so it can't be deleted. Ask an accountant or admin." }, { status: 409 });
    }
    if (!(await dataStore.deleteTimeEntry(params.id))) return NextResponse.json({ success: false, error: "Time entry not found" }, { status: 404 });
    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
