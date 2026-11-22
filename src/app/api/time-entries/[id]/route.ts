import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
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
  if (current && !isManager(g.user) && current.userId !== g.user.id) {
    return NextResponse.json({ success: false, error: "That entry belongs to someone else." }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (!isManager(g.user)) {
      // Review state is the accountant's; engineers just edit their own details.
      for (const k of ["status", "flagged", "flagReason", "userId"]) delete body[k];
    }
    const updated = await dataStore.updateTimeEntry(params.id, body);
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
