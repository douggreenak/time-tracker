import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { MIN_PASSWORD } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** First-run only: creates the first admin when the database has no people at all. */
export async function POST(request: Request) {
  try {
    if ((await dataStore.getUsers()).length > 0) {
      return NextResponse.json({ success: false, error: "Setup is already done." }, { status: 409 });
    }
    const { name, email, password } = await request.json();
    if (!name?.trim() || !email?.trim()) return NextResponse.json({ success: false, error: "Name and email are required." }, { status: 400 });
    if (typeof password !== "string" || password.length < MIN_PASSWORD)
      return NextResponse.json({ success: false, error: `Use a password of at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    const user = await dataStore.addUser({
      name: name.trim(),
      email: email.trim(),
      role: "admin",
      passwordHash: await hashPassword(password),
    });
    const res = NextResponse.json({ success: true, data: user }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
    return res;
  } catch (error) {
    console.error("setup failed:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
