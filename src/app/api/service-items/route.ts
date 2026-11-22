import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await dataStore.getServiceItems();
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, qbItemName, defaultBillable } = body;
    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    const item = await dataStore.addServiceItem(name, qbItemName, defaultBillable);
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
