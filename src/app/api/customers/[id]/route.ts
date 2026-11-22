import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    for (const key of ["name", "qbName", "isActive"]) if (body[key] !== undefined) updates[key] = body[key];
    if (typeof updates.name === "string") {
      updates.name = updates.name.trim();
      if (!updates.name) return NextResponse.json({ success: false, error: "Name can't be empty" }, { status: 400 });
    }
    const updated = await dataStore.updateCustomer(params.id, updates);
    if (!updated) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await dataStore.deleteCustomer(params.id);
    if (result === "not_found") return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    if (result === "in_use")
      return NextResponse.json(
        { success: false, error: "Customer has time entries — archive it instead of deleting." },
        { status: 409 }
      );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
