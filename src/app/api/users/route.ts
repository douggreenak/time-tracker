import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isAdmin, isManager, requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { MIN_PASSWORD } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const users = await dataStore.getUsers();
    // Billing rates show on invoices, so everyone signed in can see them.
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Failed to load users:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Anyone signed in can add people, but only engineers and accountants (admins are made by admins).
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { name, email, role, defaultHourlyRate, password } = await request.json();
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ success: false, error: "Name and email are required" }, { status: 400 });
    }
    if (role !== undefined && !["engineer", "accountant", "admin"].includes(role)) {
      return NextResponse.json({ success: false, error: "Unknown role." }, { status: 400 });
    }
    if (role === "admin" && !isAdmin(g.user)) {
      return NextResponse.json({ success: false, error: "Only an admin can add another admin." }, { status: 403 });
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD) {
      return NextResponse.json({ success: false, error: `Set a starting password of at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    }
    const users = await dataStore.getUsers();
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return NextResponse.json({ success: false, error: "Someone with that email already exists" }, { status: 409 });
    }
    const user = await dataStore.addUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      defaultHourlyRate: defaultHourlyRate === undefined ? undefined : Number(defaultHourlyRate),
      passwordHash: await hashPassword(password),
    });
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error("Failed to add user:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
