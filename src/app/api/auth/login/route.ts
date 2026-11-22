import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, loginThrottle, recordLogin, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // first request after a cold start may create the tables

export async function POST(request: Request) {
  try {
    const { userId, password } = await request.json();
    if (!userId || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Choose your name and enter your password." }, { status: 400 });
    }
    const wait = loginThrottle(userId);
    if (wait) {
      return NextResponse.json({ success: false, error: `Too many attempts. Try again in ${wait}s.` }, { status: 429 });
    }
    const rec = await dataStore.getUserForAuth(userId);
    const ok = !!rec && (await verifyPassword(password, rec.passwordHash));
    recordLogin(userId, ok);
    if (!rec || !ok) {
      const noPw = rec && !rec.passwordHash;
      return NextResponse.json(
        { success: false, error: noPw ? "No password is set for this person yet — ask an admin to set one." : "Wrong password." },
        { status: 401 }
      );
    }
    const res = NextResponse.json({ success: true, data: rec.user });
    res.cookies.set(SESSION_COOKIE, createSessionToken(rec.user.id), sessionCookieOptions());
    return res;
  } catch (error) {
    console.error("login failed:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
