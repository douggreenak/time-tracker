import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";

export async function GET() {
  try {
    const users = await dataStore.getUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
