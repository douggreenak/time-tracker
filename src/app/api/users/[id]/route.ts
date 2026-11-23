import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isAdmin, isManager, requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { MIN_PASSWORD } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const body = await request.json();
    const self = g.user.id === params.id;
    // Everyone may edit their own name and email; accountants and admins may also edit anyone's details and rate;
    // only admins may change roles or passwords.
    if (!isManager(g.user)) {
      if (!self) return NextResponse.json({ success: false, error: "You can only edit your own details." }, { status: 403 });
      if (Object.keys(body).some((k) => !["name", "email"].includes(k)))
        return NextResponse.json({ success: false, error: "You can change your name and email here. Ask an admin about anything else." }, { status: 403 });
    }
    if (!isAdmin(g.user)) {
      const target = await dataStore.getUserById(params.id);
      if (body.password !== undefined || (body.role !== undefined && body.role !== target?.role))
        return NextResponse.json({ success: false, error: "Only an admin can change roles or passwords." }, { status: 403 });
      delete body.role;
    }
    const updates: Record<string, unknown> = {};
    for (const k of ["name", "email", "role", "qbEmployeeName"]) {
      if (typeof body[k] === "string") updates[k] = k === "email" ? body[k].trim().toLowerCase() : body[k].trim();
    }
    if (body.defaultHourlyRate !== undefined) {
      const rate = Number(body.defaultHourlyRate);
      if (!Number.isFinite(rate) || rate < 0) {
        return NextResponse.json({ success: false, error: "Hourly rate must be a number" }, { status: 400 });
      }
      updates.defaultHourlyRate = rate;
    }
    if (updates.name === "" || updates.email === "") {
      return NextResponse.json({ success: false, error: "Name and email can't be empty" }, { status: 400 });
    }
    if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < MIN_PASSWORD)) {
      return NextResponse.json({ success: false, error: `Use a password of at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    }
    if (body.role !== undefined && !["engineer", "accountant", "admin"].includes(body.role)) {
      return NextResponse.json({ success: false, error: "Unknown role." }, { status: 400 });
    }
    if (body.role !== undefined && g.user.id === params.id && body.role !== g.user.role) {
      return NextResponse.json({ success: false, error: "You can't change your own role." }, { status: 400 });
    }
    const updated = await dataStore.updateUser(params.id, updates);
    if (updated && body.password !== undefined) await dataStore.setPassword(params.id, await hashPassword(body.password));
    if (!updated) return NextResponse.json({ success: false, error: "Person not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const dupe = String((error as { message?: string })?.message ?? "").includes("unique");
    return NextResponse.json(
      { success: false, error: dupe ? "Someone with that email already exists" : "Internal Server Error" },
      { status: dupe ? 409 : 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser({ admin: true });
  if (!g.ok) return g.res;
  if (g.user.id === params.id) return NextResponse.json({ success: false, error: "You can't remove yourself." }, { status: 400 });
  try {
    const result = await dataStore.deleteUser(params.id);
    if (result === "not_found") return NextResponse.json({ success: false, error: "Person not found" }, { status: 404 });
    if (result === "in_use")
      return NextResponse.json({ success: false, error: "This person has time entries — they can't be deleted." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
