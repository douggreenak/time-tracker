import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await currentUser() });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
