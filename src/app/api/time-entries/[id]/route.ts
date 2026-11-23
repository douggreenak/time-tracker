import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";
import { checkDate, checkMinutes, checkNotes, STATUSES } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const found = await dataStore.getTimeEntryById(params.id);
  if (found && !isManager(g.user) && found.userId !== g.user.id) {
    return NextResponse.json({ success: false, error: "That entry belongs to someone else." }, { status: 403 });
  }
  try {
    const entry = await dataStore.getTimeEntryById(params.id);
    if (!entry) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const current = await dataStore.getTimeEntryById(params.id);
  try {
    const body = await request.json();
    if (current && !isManager(g.user) && current.userId !== g.user.id) {
      return NextResponse.json({ success: false, error: "That entry belongs to someone else." }, { status: 403 });
    }
    if (!isManager(g.user)) {
      // Review state is the accountant's; engineers just edit their own details.
      // The one exception: moving your own time between draft and submitted, until the accountant has acted on it.
      const wanted = body.status;
      const mayToggle = (wanted === "draft" || wanted === "submitted") && (current?.status === "draft" || current?.status === "submitted");
      for (const k of ["status", "flagged", "flagReason", "userId", "dismissedIssues"]) delete body[k];
      if (mayToggle) body.status = wanted;
    }
    if (body.dismissedIssues !== undefined) {
      const known = ["missing", "long_day", "weekend", "no_notes", "duplicate", "future"];
      if (!Array.isArray(body.dismissedIssues) || body.dismissedIssues.some((x: unknown) => typeof x !== "string" || !known.includes(x)))
        return NextResponse.json({ success: false, error: "Unknown check." }, { status: 400 });
    }
    const bad =
      (body.durationMinutes !== undefined && checkMinutes(body.durationMinutes)) ||
      (body.date !== undefined && checkDate(body.date)) ||
      checkNotes(body.notes) ||
      (body.status !== undefined && !(STATUSES as readonly string[]).includes(body.status) ? "Unknown status." : null);
    if (bad) return NextResponse.json({ success: false, error: bad }, { status: 400 });
    // Customer, project and task are optional; "" clears them.
    const newCustomer = body.customerId !== undefined ? body.customerId : current?.customerId;
    if (body.customerId || body.jobId || body.serviceItemId) {
      const customers = await dataStore.getCustomers();
      const cust = customers.find((c) => c.id === newCustomer);
      if (body.customerId && !cust) return NextResponse.json({ success: false, error: "Unknown customer." }, { status: 400 });
      if (body.jobId && !cust?.jobs.some((j) => j.id === body.jobId))
        return NextResponse.json({ success: false, error: "That project doesn't belong to this customer." }, { status: 400 });
      if (body.serviceItemId && !(await dataStore.getServiceItems()).some((s) => s.id === body.serviceItemId))
        return NextResponse.json({ success: false, error: "Unknown task." }, { status: 400 });
    }
    const updated = await dataStore.updateTimeEntry(params.id, body, g.user.name);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Time entry not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const current = await dataStore.getTimeEntryById(params.id);
  if (current && !isManager(g.user) && current.userId !== g.user.id) {
    return NextResponse.json({ success: false, error: "That entry belongs to someone else." }, { status: 403 });
  }
  try {
    if (current && !isManager(g.user) && (current.status === "approved" || current.status === "exported")) {
      return NextResponse.json(
        { success: false, error: "Approved or exported entries can be edited but not deleted — edit the hours instead and your accountant will be flagged." },
        { status: 409 }
      );
    }
    const success = await dataStore.deleteTimeEntry(params.id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Time entry not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
