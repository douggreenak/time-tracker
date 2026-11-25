import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    return NextResponse.json({ success: true, data: await dataStore.getCustomers() });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { name } = await request.json();
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Customer name required" }, { status: 400 });
    }
    const customer = await dataStore.addCustomer(name.trim());
    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
