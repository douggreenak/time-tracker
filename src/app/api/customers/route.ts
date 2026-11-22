import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const customers = await dataStore.getCustomers();
    return NextResponse.json({ success: true, data: customers });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const body = await request.json();
    const { type, name, qbName, customerId } = body;

    if (type === "job") {
      if (!customerId || !name) {
        return NextResponse.json({ success: false, error: "customerId and name required for job" }, { status: 400 });
      }
      const job = await dataStore.addJob(customerId, name);
      if (!job) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
      return NextResponse.json({ success: true, data: job }, { status: 201 });
    }

    if (!name) {
      return NextResponse.json({ success: false, error: "Customer name required" }, { status: 400 });
    }

    const customer = await dataStore.addCustomer(name, qbName);
    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
