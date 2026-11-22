import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
  try {
    const body = await request.json();
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
  try {
    const success = await dataStore.deleteTimeEntry(params.id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Time entry not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
