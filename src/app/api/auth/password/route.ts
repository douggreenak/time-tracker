import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/auth";
import { MIN_PASSWORD } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Change your own password. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { currentPassword, newPassword } = await request.json();
    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD)
      return NextResponse.json({ success: false, error: `Use a new password of at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    const rec = await dataStore.getUserForAuth(g.user.id);
    if (!rec || !(await verifyPassword(String(currentPassword ?? ""), rec.passwordHash)))
      return NextResponse.json({ success: false, error: "Your current password is wrong." }, { status: 401 });
    await dataStore.setPassword(g.user.id, await hashPassword(newPassword));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
