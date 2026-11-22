import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";

export const dynamic = "force-dynamic";

/** Public: just enough for the sign-in screen (names + roles, never emails or hashes). */
export async function GET() {
  try {
    const [users, isDemo] = await Promise.all([dataStore.getUsers(), dataStore.isDemo()]);
    return NextResponse.json({
      success: true,
      data: { users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })), isDemo, needsSetup: users.length === 0 },
    });
  } catch (error) {
    console.error("auth/users failed:", error);
    return NextResponse.json({ success: false, error: `Database error: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
